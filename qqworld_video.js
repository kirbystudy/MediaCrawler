import fetch from 'node-fetch';
import fs from 'fs';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cheerio from 'cheerio';
import cliProgress from 'cli-progress';
import readline from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url));

const HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    Cookie:
        'xhsTrackerId=a32db973-f67d-4842-a047-f60a6dfb64bd; xhsTrackerId.sig=pze-jfxgqNP0jmBwKyjA2awterEQPKQTDa1ZkvvsPIo; xhsTracker=url=explore&searchengine=baidu; xhsTracker.sig=u1cFYHAwm89lKbFLL1Y8vp9JcskioXWTa56RKaAB2ys; xsecappid=xhs-pc-web; a1=18834163b32fq9eg76e7cap0vs5ld3veuvpmhktco50000424130; webId=71199a5d0b387d06f3f1fa825b4071f0; gid=yYYq4yKqYi7iyYYq4yKqDhT9qJiAjdkWKdWSUSl0U8hM26281fqhdx8884J4yq88DS04f42S; gid.sign=W8CEAhgALtsKx2rpcArnuEyWR24=; webBuild=2.11.4; web_session=040069b5f5e5ce20e2f81088a4364ba65d30f0; websectiga=f3d8eaee8a8c63016320d94a1bd00562d516a5417bc43a032a80cbf70f07d5c0; sec_poison_id=455f2c76-fc1b-4caa-9e81-8b3d24858411.1c0867ec69231f446ab9de4bb8c4a1cc; Hm_lvt_9df4eb7fd5f9e857affabee879b4b904=1652362218,1652403516,1652507458,1652589443; Hm_lpvt_9df4eb7fd5f9e857affabee879b4b904=1652593120'
};


(async () => {
    try {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise((resolve) => {
            rl.question('请输入视频链接：', (input) => {
                resolve(input);
            });
        });

        const urls = answer.split(' ');
        // 在这里可以对用户输入进行处理或者执行相关操作

        rl.close();

        await downloadVideos(urls);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();

function createDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
        console.log(`创建新的文件夹：${dirPath}`);
    }
}

async function downloadVideos(urls) {
    try {
        console.log(`待下载视频数量：${urls.length}`);

        createDirectory(`${__dirname}/video`);

        const progress = new cliProgress.SingleBar(
            {
                format: '总进度：{bar} | {percentage}% | {value}/{total}',
                stopOnComplete: true
            },
            cliProgress.Presets.shades_classic
        );
        progress.start(urls.length, 0);

        const downloadTasks = urls.map(async (url) => {
            try {
                const html = await getHtmlFromUrl(url);
                const videoInfo = parseVideoLink(html);
                console.log(`\n开始下载视频：${videoInfo.title}`);

                const folder = `${__dirname}/video/${videoInfo.title}`;
                createDirectory(folder);

                const dest = `${folder}/${videoInfo.videoId}.mp4`;
                await downloadVideo(videoInfo.videoUrl, dest);

                console.log(`\n下载完成：${videoInfo.title}`);
            } catch (error) {
                console.error('\n视频下载失败：', error);
            } finally {
                progress.increment();

                if (progress.value === progress.total) {
                    progress.stop();
                    console.log('\n所有视频下载完成！');
                    process.exit(0);
                }
            }
        });

        await Promise.all(downloadTasks);

    } catch (error) {
        if (error instanceof TypeError) {
            console.error('\n获取数据失败：', error);
            process.exit(1)
        } else if (error instanceof Error) {
            console.error('\n视频下载失败：', error);
            process.exit(1)
        }
    }
}

async function getHtmlFromUrl(url) {
    try {
        const response = await fetch(url, { headers: HEADERS });
        const html = await response.text();
        return html
    } catch (err) {
        throw new Error(`获取 ${url} 数据失败：${err}`);
    }
}

function parseVideoLink(html) {
    const $ = cheerio.load(html);
    const scripts = $('script').get();

    const result = scripts
        .map(({ children }) => children[0] && children[0].data)
        .find(text => text && text.startsWith('window.__INITIAL_STATE__='));

    if (result !== undefined) {
        const jsonStr = result.slice(result.indexOf('=') + 1);
        const jsonData = jsonStr.replace(/undefined/g, 'null');
        try {
            const data = JSON.parse(jsonData);
            if (data === null) {
                throw new Error('未找到视频链接');
            }
            let title = data.feeds[0].content.replace(/#{tagName=(.*?)}/g, '$1');
            let videoId = data.feeds[0].id
            let videoUrl = data.feeds[0].video.vecVideoUrl[0].playUrl
            return { title, videoId, videoUrl }
        } catch (error) {
            throw new Error(`解析 JSON 失败：${error}`);
        }
    } else {
        throw new Error('没有找到对应的 script 标签');
    }
}

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