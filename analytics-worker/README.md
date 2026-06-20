# 岚生博客访客统计

这个目录包含博客的 Cloudflare Worker。博客只发送访问事件，Worker 从 Cloudflare 请求头取得真实访客 IP，并把数据写入 D1。`admin.lansei.top` 提供手机和电脑都能使用的私有管理后台，内容发布通过 GitHub API 完成。

## 部署

1. 登录并创建数据库：

   ```powershell
   npx wrangler login
   npx wrangler d1 create lansei-blog-analytics
   ```

2. 把返回的 `database_id` 填入 `wrangler.toml`，然后初始化数据库：

   ```powershell
   npx wrangler d1 execute lansei-blog-analytics --remote --file schema.sql
   ```

3. 在 Cloudflare Zero Trust 中创建 Self-hosted Access application：

   - Domain: `admin.lansei.top`
   - Path 留空，保护整个域名
   - Allow policy 只加入自己的邮箱

4. 将 Access 的 Team domain 和 Application AUD 填入 `wrangler.toml`，并把管理员邮箱与 GitHub fine-grained token 存为 Worker secret。Token 只授权 `collinloy08-cloud/lansei-blog` 仓库的 Contents 读写权限：

   ```powershell
   npx wrangler secret put ADMIN_EMAIL
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler deploy
   ```

5. 部署完成后访问：

   - 采集入口：`https://lansei-blog-analytics.collinloy08.workers.dev/collect`
   - 健康检查：`https://analytics.lansei.top/health`
   - 私有管理后台：`https://admin.lansei.top`

## 本地永久备份

`backup-analytics.ps1` 会把整个 D1 数据库导出为带时间戳的 SQL 文件，保存在本机的 `backups/` 目录。计划任务默认每周日 21:00 执行，错过后会在下次开机时补跑。

## 隐私与数据

- 原始 IP 仅保存在 D1，不会返回到博客前台。
- D1 中的记录不会自动删除，本地 SQL 快照也不会自动清理。
- 尊重浏览器的 Global Privacy Control 和 Do Not Track。
- 管理页可导出最近 10,000 条 CSV；完整历史以本地 SQL 快照为准。导出文件含完整 IP，不要公开。
