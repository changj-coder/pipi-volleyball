# RUN Platform Deployment

RUN Platform 的容器本身就是部署環境，不需要在容器內執行 Dockerfile 或 docker 指令。

## 建議部署方式

使用 GitHub 匯入專案，然後在 RUN 容器內直接安裝、build、啟動服務。

## 平台設定

- 專案來源：GitHub repo
- Branch：`main`
- 容器內服務 port：`9467`
- 自訂網域：例如 `pipivolleyball`

## SSH 進容器後執行

進入 RUN 平台提供的 SSH 後，依序執行：

```bash
cd ~/project
npm install
npm run build
nohup npm start > /tmp/pipi-volleyball.log 2>&1 &
```

確認服務：

```bash
curl -I http://127.0.0.1:9467
tail -100 /tmp/pipi-volleyball.log
```

## 端口映射

在 RUN 平台加入 port mapping：

```text
container_port = 9467
```

如果使用自訂網域，將網域綁定到此專案後，即可用：

```text
https://pipivolleyball.run.ingarena.net/
```

## 更新版本

每次 GitHub 有新版本後，SSH 進容器執行：

```bash
cd ~/project
git pull
npm install
npm run build
pkill -f "vite preview" || true
nohup npm start > /tmp/pipi-volleyball.log 2>&1 &
```

## 注意

- 不要上傳 `node_modules`。
- 不要在 RUN 容器內使用 Dockerfile 或 docker 命令。
- 若網頁出現 `502 Bad Gateway`，通常代表容器內服務沒有在 `9467` 正常啟動，或 port mapping 沒設到 `9467`。
