import axios from 'axios';
import request from 'request';
import fs from 'fs'
import { mkdirp } from 'mkdirp';
import cheerio from 'cheerio';
import path from 'path';

/**
 * 创建文件夹
 *
 * @param {string} folderPath - 文件夹路径
 */
function mkdir(folderPath) {
    const isFolderExist = fs.existsSync(folderPath);
    if (!isFolderExist) {
        console.log(`正在创建新文件夹: ${folderPath}`);
        mkdirp(folderPath);
        console.log('创建成功!');
    } else {
        console.log(`文件夹已存在: ${folderPath}`);
    }
}

/**
 * 获取html页面文本
 *
 * @param {string} url - 页面地址
 * @param {object} headers - 请求头
 * @returns {Promise<string>}
 */
/**
 * 获取html页面文本
 *
 * @param {string} url - 页面地址
 * @param {object} headers - 请求头
 * @returns {Promise<string>}
 */
function fetchHtml(url, headers) {
    return new Promise((resolve, reject) => {
        request.get({ url, headers }, function (err, response, body) {
            if (err || response.statusCode !== 200) {
                reject(new Error(`无法获取HTML URL:${url}, status code: ${response.statusCode}`));
            } else {
                resolve(body);
            }
        });
    });
}


/**
 * 正则表达式匹配除中文、字母、数字外的所有字符，并将其替换为空
 *
 * @param {string} title - 标题
 * @returns {string}
 */
function cleanTitle(title) {
    return title.replace(/[^\u4e00-\u9fa5\w]/g, '');
}

/**
 * 解析html文本，提取无水印图片的 url
 *
 * @param {string} html - 页面html文本
 */
async function getPictures(html) {
    const $ = cheerio.load(html);
    let success = false; // 通过 success 变量来判断是否成功获取图片链接
    let retryCount = 0; // 重试次数初始化为 0
    while (!success && retryCount < 5) { // 最多重试 5 次
        const scripts = $('script').get();
        const result = scripts
            .map(({ children }) => children[0] && children[0].data) // 获取 script 标签中的文本信息
            .find(text => text && text.startsWith('window.__INITIAL_STATE__=')); // 查找 window.__INITIAL_STATE__= 字符串

        if (result !== undefined) {
            success = true; // 如果找到了对应字符串，则设置 success 为 true
            const jsonStr = result.slice(result.indexOf('=') + 1); // 截取 JSON 数据
            const jsonData = jsonStr.replace(/undefined/g, 'null'); // 将 undefined 替换为 null
            try {
                const data = JSON.parse(jsonData); // 解析 JSON 数据
                if (data === null || !data.note.note.imageList) { // 如果没有找到图片链接则抛出错误
                    throw new Error('未找到图片链接');
                }

                let imageList = data.note.note.imageList;
                let title = data.note.note.title;
                console.log(`开始下载 ${imageList.length}张 图片`);
                let folderPath = './images/' + cleanTitle(title);
                mkdir(folderPath);

                for (let i = 0; i < imageList.length; i++) {
                    let picUrl = `https://sns-img-qc.xhscdn.com/${imageList[i].traceId}`;
                    let filename = `${folderPath}/${imageList[i].traceId}.jpg`;
                    // 检查文件是否已存在
                    if (fs.existsSync(filename)) {
                        console.log(`文件 ${filename} 已存在，跳过下载`);
                        continue;
                    }
                    await download(picUrl, filename);
                }
            } catch (error) { // 解析 JSON 和下载图片的过程中可能出现异常
                console.log(`解析 JSON 失败：${error}`);
                retryCount++; // 当解析 JSON 或下载图片失败时，增加重试次数，并等待一段时间后再进行重试
                await sleep(3000);
            }
        } else { // 如果没有找到对应字符串，则抛出错误
            console.log('没有找到对应的 script 标签');
            retryCount++; // 增加重试次数
            await sleep(3000);
        }
    }
    if (retryCount === 5) { // 重试 3 次仍未成功获取到图片链接时，抛出错误
        throw new Error('重试5次仍未成功获取图片链接');
    }
}

// 定义一个睡眠函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * 下载文件到本地目录
 * @param {String} url - 文件的URL地址
 * @param {String} filePath - 保存到本地的文件路径（包括文件名）
 * @param {Number} retries - 当前已经重试的次数
 * @param {Number} maxRetries - 最大重试次数
 * @return {Promise} - 返回一个Promise对象
 */
/**
 * 下载文件到本地目录
 * @param {String} url - 文件的URL地址
 * @param {String} filePath - 保存到本地的文件路径（包括文件名）
 * @param {Number} retries - 当前已经重试的次数
 * @param {Number} maxRetries - 最大重试次数
 * @return {Promise} - 返回一个Promise对象
 */
async function download(url, filePath, retries = 0, maxRetries = 5) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    };
    const timeout = 10000; // 设置超时时间为10秒

    try {
        // 发送GET请求并获取响应内容
        const response = await axios.get(url, { headers, responseType: 'arraybuffer', timeout });

        if (response.status !== 200) {
            throw new Error(`下载图片失败 ${filePath}`);
        }

        // 把内容写入到文件
        fs.writeFileSync(filePath, response.data);

        console.log(`图片 ${filePath} 下载成功!`);
        return filePath;
    } catch (error) {
        retries++;

        if (retries < maxRetries) {
            console.error(`下载图片失败 ${path.basename(filePath)}, 重试(${retries}/${maxRetries})...`);

            // 递归调用本身，并传入重试次数
            return await download(url, filePath, retries, maxRetries);
        } else {
            console.error(`下载图片失败 ${path.basename(filePath)}, 重试次数已达到上限`);
            throw error;
        }
    }
}

/**
 * 遍历urls，批量下载去水印图片
 *
 * @param {[string]} urls - 页面地址列表
 * @param {string} cookie - cookies
 */
async function loopLink(urls, cookie) {
    const headers = {
        accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        cookie,
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    };
    for (let i = 0; i < urls.length; i++) {
        try {
            const html = await fetchHtml(urls[i], headers);
            await getPictures(html);
        } catch (error) {
            throw new Error(`无法处理 URL ${urls[i]}: ${error}`);
        }
    }
}

(async () => {
    const urls = [
        'https://www.xiaohongshu.com/explore/64781bdd0000000013004fdf'
    ];
    const cookie = 'xhsTrackerId=a32db973-f67d-4842-a047-f60a6dfb64bd; xhsTrackerId.sig=pze-jfxgqNP0jmBwKyjA2awterEQPKQTDa1ZkvvsPIo; xhsTracker=url=explore&searchengine=baidu; xhsTracker.sig=u1cFYHAwm89lKbFLL1Y8vp9JcskioXWTa56RKaAB2ys; xsecappid=xhs-pc-web; a1=18834163b32fq9eg76e7cap0vs5ld3veuvpmhktco50000424130; webId=71199a5d0b387d06f3f1fa825b4071f0; gid=yYYq4yKqYi7iyYYq4yKqDhT9qJiAjdkWKdWSUSl0U8hM26281fqhdx8884J4yq88DS04f42S; gid.sign=W8CEAhgALtsKx2rpcArnuEyWR24=; web_session=040069b5f5e5ce20e2f81088a4364ba65d30f0; webBuild=2.11.4; websectiga=59d3ef1e60c4aa37a7df3c23467bd46d7f1da0b1918cf335ee7f2e9e52ac04cf; sec_poison_id=ec285d80-f9f8-426e-827c-2ad206e8eae4; acw_tc=fa9509dd41e4495ab1d6a36dd5c3f381e29923205bb1c7f571c1cc313781d99e';

    try {
        await loopLink(urls, cookie);
        console.log('所有图片下载成功!');
    } catch (error) {
        console.error('下载图片失败:', error);
    }
})();
