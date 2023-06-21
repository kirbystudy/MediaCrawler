import fetch from 'node-fetch'; // 导入 node-fetch库，用于发出HTTP请求
import fs from 'fs'; // 导入 fs 模块，用于读写文件
import { mkdirSync } from 'fs'; // 导入 mkdirSync 函数，用于创建目录
import { dirname } from 'path'; // 导入 dirname 函数，用于获取当前文件所在目录
import { fileURLToPath } from 'url'; // 导入 fileURLToPath 函数，用于获取当前文件路径
import cheerio from 'cheerio'; // 导入 cheerio 库，用于解析 HTML 页面
import cliProgress from 'cli-progress'; // 导入 cli-progress 库，用于显示下载进度条

const __dirname = dirname(fileURLToPath(import.meta.url));

const HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    Cookie:
        'xhsTrackerId=a32db973-f67d-4842-a047-f60a6dfb64bd; xhsTrackerId.sig=pze-jfxgqNP0jmBwKyjA2awterEQPKQTDa1ZkvvsPIo; xhsTracker=url=explore&searchengine=baidu; xhsTracker.sig=u1cFYHAwm89lKbFLL1Y8vp9JcskioXWTa56RKaAB2ys; xsecappid=xhs-pc-web; a1=18834163b32fq9eg76e7cap0vs5ld3veuvpmhktco50000424130; webId=71199a5d0b387d06f3f1fa825b4071f0; gid=yYYq4yKqYi7iyYYq4yKqDhT9qJiAjdkWKdWSUSl0U8hM26281fqhdx8884J4yq88DS04f42S; gid.sign=W8CEAhgALtsKx2rpcArnuEyWR24=; webBuild=2.11.4; web_session=040069b5f5e5ce20e2f81088a4364ba65d30f0; websectiga=f3d8eaee8a8c63016320d94a1bd00562d516a5417bc43a032a80cbf70f07d5c0; sec_poison_id=455f2c76-fc1b-4caa-9e81-8b3d24858411.1c0867ec69231f446ab9de4bb8c4a1cc; Hm_lvt_9df4eb7fd5f9e857affabee879b4b904=1652362218,1652403516,1652507458,1652589443; Hm_lpvt_9df4eb7fd5f9e857affabee879b4b904=1652593120'
};

/**
 * 从指定 URL 获取 HTML 页面内容
 * @param {string} url - 页面 URL
 * @returns {Promise<string>} 返回 HTML 页面内容的 Promise 对象
 */
async function getHtmlFromUrl(url) {
    try {
        const response = await fetch(url, { headers: HEADERS });
        const html = await response.text();
        return html;
    } catch (err) {
        throw new Error(`获取 ${url} 数据失败：${err}`);
    }
}

/**
 * 整理标题中的非法字符
 * @param {string} title - 原始标题
 * @returns {string} 整理后的标题
 */
function cleanTitle(title) {
    return title.replace(/[^\u4e00-\u9fa5\w]/g, '');
}

/**
 * 从 HTML 页面中解析出视频链接和相关信息
 * @param {string} html - HTML 页面内容
 * @returns {Object} 包含视频标题、视频 ID 和视频链接的信息对象
 * @throws {Error} 如果在页面中找不到 JSON 数据或者视频链接，则抛出异常
 */
function parseVideoLink(html) {
    const $ = cheerio.load(html);
    // 获取所有 script 标签
    const scripts = $('script').get();

    // 在标签中查找以 window.__INITIAL_STATE__ 开头的字符串，并返回第一个符合条件的字符串
    const result = scripts
        .map(({ children }) => children[0] && children[0].data)
        .find(text => text && text.startsWith('window.__INITIAL_STATE__='));

    if (result !== undefined) {
        // 如果找到了对应字符串，就解析出其中的 JSON 数据并打印
        const jsonStr = result.slice(result.indexOf('=') + 1); // 去掉开头的 window.__INITIAL_STATE__=
        const jsonData = jsonStr.replace(/undefined/g, 'null');

        try {
            const data = JSON.parse(jsonData);
            // 检查是否有视频信息
            if (data === null || !data.note.note.video.media.stream.h264[0].masterUrl) {
                throw new Error('未找到视频链接');
            }
            let title = cleanTitle(data.note.note.title);
            if (title === '') {
                title = cleanTitle(data.note.note.desc);
            }
            const videoId = data.note.note.video.media.videoId;
            const videoUrl = data.note.note.video.media.stream.h264[0].masterUrl;
            return { title, videoId, videoUrl };
        } catch (error) {
            throw new Error(`解析 JSON 失败：${error}`);
        }
    } else {
        // 如果没有找到对应字符串，抛出错误信息
        throw new Error('没有找到对应的 script 标签');
    }
}

/**
 * 下载视频到本地
 * @param {string} videoUrl - 视频链接地址
 * @param {string} dest - 视频保存路径
 * @returns {Promise<void>} 下载完成后的 Promise 对象
 */
async function downloadVideo(videoUrl, dest) {
    const response = await fetch(videoUrl, {
        headers: HEADERS
    });

    const totalBytes = Number(response.headers.get('content-length'));
    const bar = new cliProgress.SingleBar(
        {
            format: `下载进度：{bar} | {percentage}% | {value}/{total} Bytes`
        },
        cliProgress.Presets.shades_classic
    );
    bar.start(totalBytes, 0);

    // 将下载的视频数据写入文件流中
    const writer = fs.createWriteStream(dest);
    response.body.pipe(writer);

    return new Promise((resolve, reject) => {
        response.body.on('error', err => {
            reject(err);
        });

        writer.on('finish', () => {
            bar.stop();
            resolve();
        });

        writer.on('error', err => {
            reject(err);
        });

        response.body.on('data', chunk => {
            bar.increment(chunk.length);
        });
    });
}

/**
 * 创建目录
 * @param {string} dirPath - 目录路径
 * @returns {void}
 */
function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.log(`创建新的文件夹：${dirPath}`);
    }
}

/**
 * 下载多个视频到本地
 * @param {array} urls - 视频链接数组
 * @returns {Promise<void>} 当所有视频下载完成后，返回 Promise 对象
 */
async function downloadVideos(urls) {
    try {
        createDirectory(`${__dirname}/video`);

        const bar = new cliProgress.SingleBar(
            {
                format: '总进度：{bar} | {percentage}% | {value}/{total}'
            },
            cliProgress.Presets.shades_classic
        );
        bar.start(urls.length, 0);

        for (const url of urls) {
            const html = await getHtmlFromUrl(url);
            const videoInfo = parseVideoLink(html);
            console.log(`\n开始下载视频：${videoInfo.title}`);

            // 根据视频的标题创建相应的文件夹
            const folder = `${__dirname}/video/${videoInfo.title}`;
            createDirectory(folder);

            const dest = `${folder}/${videoInfo.videoId}.mp4`;
            await downloadVideo(videoInfo.videoUrl, dest);

            bar.increment();
            console.log(`\n下载完成：${videoInfo.title}`);
        }

        bar.stop();
        console.log('所有视频下载完成！');
    } catch (error) {
        if (error instanceof TypeError) {
            console.error('\n获取数据失败：', error);
        } else if (error instanceof Error) {
            console.error('\n视频下载失败：', error);
        }
    }
}

// 下载指定 URL 的视频
(async () => {
    try {
        const urls = ['https://www.xiaohongshu.com/explore/6408802a000000000703b89b'];
        await downloadVideos(urls);
        process.exit(); // 完成下载后退出程序
    } catch (error) {
        console.error(error);
        process.exit(1) // 下载出错时退出程序，返回非零状态码
    }
})();