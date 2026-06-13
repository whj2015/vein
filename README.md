# Vein — Xray 代理管理面板

从零重建的安全、可审计的 Xray 管理面板。

## 开发

```bash
npm install
npm run dev        # 前后端同时启动
```

- 前端: http://localhost:3000
- 后端: http://localhost:54321

## 部署

```bash
bash install.sh    # VPS 一键安装
```

## 安全

- 零外部 CDN
- 零遥测/回传
- Xray 配置纯 JSON 模板生成
- JWT + bcrypt 认证
