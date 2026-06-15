# 把博客部署到 GitHub Pages 并绑定 lansei.top

## 1. 上传博客文件

在 GitHub 新建一个仓库，比如 `lansei-blog`。把当前目录里的所有文件上传到仓库根目录，确保 `index.html`、`content.js`、`styles.css`、`editor.html`、`CNAME` 都在仓库根目录。

## 2. 开启 GitHub Pages

进入仓库：

1. `Settings`
2. `Pages`
3. `Build and deployment`
4. Source 选择 `Deploy from a branch`
5. Branch 选择 `main`，目录选择 `/root`
6. 保存

几分钟后，GitHub 会给你一个默认地址，通常类似：

`https://你的用户名.github.io/仓库名/`

## 3. 绑定自定义域名

在 GitHub 仓库的 `Settings -> Pages -> Custom domain` 中填写：

`lansei.top`

保存后，仓库根目录需要存在一个 `CNAME` 文件，里面只写：

`lansei.top`

这个文件我已经放好了。

## 4. 在阿里云 DNS 添加解析

进入阿里云域名控制台：

`域名解析 -> 解析设置 -> 添加记录`

添加 4 条 A 记录：

| 记录类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

如果你也想让 `www.lansei.top` 可访问，再加一条：

| 记录类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| CNAME | www | 你的用户名.github.io |

注意这里的 `你的用户名.github.io` 不要带仓库名。

## 5. 开启 HTTPS

DNS 生效后，回到 GitHub：

`Settings -> Pages -> Enforce HTTPS`

如果按钮暂时不可点，等一会儿再刷新。DNS 生效可能需要几分钟到 24 小时。

## 6. 检查是否成功

在 PowerShell 中可以运行：

```powershell
Resolve-DnsName lansei.top -Type A
```

看到 GitHub Pages 的 4 个 IP 后，再访问：

`https://lansei.top`
