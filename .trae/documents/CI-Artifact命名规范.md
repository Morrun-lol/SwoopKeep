# CI Artifact 命名规范

## 目的

让每次 GitHub Actions 构建的运行记录与产物（IPA、日志等）都能从名称中直接看出来源，方便追溯与区分。

## 适用范围

- 工作流：`iOS Build (Clean Project)`
- 触发方式：push / pull_request / 手动触发（workflow_dispatch）

## 命名格式

构建产物命名统一拼接一个 `ARTIFACT_TAG`：

`artifact-<BRANCH_NAME>-<PRIMARY_CHANGED_FILE>-<COMMIT_SHA7>-<UTC_TIMESTAMP>`

示例：

- `app-unsigned-ipa-artifact-master-src_renderer_pages_Statistics.tsx-1431e95-20260123091512`

字段解释：

- `BRANCH_NAME`：触发构建的分支名
- `PRIMARY_CHANGED_FILE`：本次变更中按 diff 顺序取的第一个文件名（路径中的 `/` 会被替换为 `_`）
- `COMMIT_SHA7`：提交 SHA 前 7 位
- `UTC_TIMESTAMP`：UTC 时间戳（`YYYYMMDDHHmmss`）

## 运行记录（Run Name）

运行记录名称包含：分支、SHA、提交标题（或 PR 标题/手动触发）。

## 使用说明

下载安装包：

- GitHub → Actions → 选择对应运行 → Artifacts
- 下载 `app-unsigned-ipa-<ARTIFACT_TAG>`

