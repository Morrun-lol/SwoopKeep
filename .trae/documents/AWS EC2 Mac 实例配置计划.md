# AWS EC2 Mac 实例配置计划

## 目标
配置 AWS EC2 Mac 实例作为云端 iOS 开发环境，配合 Windows 上的 Expo 开发流程。

## 实施步骤

### 1. 启动 AWS EC2 Mac 实例
- 登录 AWS 控制台
- 启动 Mac 实例（mac1.metal）
- 配置安全组（开放 SSH 和 RDP 端口）
- 等待实例启动（10-15分钟）

### 2. 连接到实例
- 安装 Microsoft Remote Desktop 和 PuTTY
- 通过 SSH 连接（命令行）
- 通过 Remote Desktop 连接（图形界面）

### 3. 配置开发环境
- 更新系统和安装 Xcode Command Line Tools
- 安装 Homebrew、Node.js、CocoaPods
- 配置 Git 和 SSH 密钥

### 4. 克隆和配置项目
- 从 GitHub 克隆项目
- 安装项目依赖
- 预构建 iOS 项目

### 5. 编译和安装应用
- 在 Xcode 中打开项目
- 配置 Apple ID 签名
- 连接 iPhone 并编译安装

### 6. 优化工作流程
- 使用 GitHub 同步代码
- 或使用 Expo EAS Build 自动化构建

## 成本
- 免费期内（180天）：$0-10
- 免费期后：约 ¥47/月（按需使用）

## 优势
✅ 180天免费使用
✅ 专业稳定的开发环境
✅ 灵活按需付费
✅ 完全独立自主