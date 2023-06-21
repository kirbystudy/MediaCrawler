# RedMediaCrawler

起源，当您在小红书上浏览图片和视频时，或许会遇到一些好看但带有小红书水印的素材。要去除水印，需要前往某个小程序，获取无水印的图片还需观看广告。

为了解决这个问题，我开发了一款名为 RedMediaCrawler 的小红书媒体文件爬虫工具，旨在解决用户下载带有水印的小红书图片和视频所面临的麻烦。这个基于 JavaScript 的工具可以获取小红书中的所有图片和视频，并且所有下载下来的文件都没有水印，让用户获得更佳的视觉体验。

使用 RedMediaCrawler 非常方便，只需要输入小红书文章的 URL 和 Cookie，该工具就会自动下载其中包括的所有图片和视频，并将它们保存在您的本地计算机上。相比于前往小程序观看广告之后才能去除水印的繁琐步骤，RedMediaCrawler 对用户而言更加简便和快捷。

## 使用方法：
1.首先克隆本仓库到您的本地计算机上。
```shell
   https://github.com/kirbystudy/RedMediaCrawler.git
```

2.进入项目目录并安装依赖项。
```shell
  cd RedMediaCrawler
  npm install
```
3.获取 cookies

* 打开小红书网站的某个文章
* 登录小红书账号
* 游览器按 `F12`。
* 点击“网络”。
* ctrl+F 输入 `cookie`，复制随便一个包的 cookie 。

修改小红书爬虫 `urls` 和 `cookies` ：

* 打开 `redbook_image.js`。
* 修改 `urls`。
* 修改自己的 `cookies`。

4.在终端中运行脚本。
```shell
  node redbook_image.js
```

## 贡献
如果您有任何意见或建议，或发现了任何问题，欢迎在 GitHub 上提出 issue 或者 pull request。我将非常感激您的贡献！

## 注意事项
请注意，该脚本仅用于学习和研究目的，严禁用于商业或非法目的。

## 致谢：
感谢开源作者[spiders](https://github.com/daxiongpro/spiders) 
