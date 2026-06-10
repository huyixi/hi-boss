# spec.md

# 招聘平台快捷话术 Chrome 插件

## 1. Goal

构建一个 Chrome Extension MV3 插件。

插件通过 Chrome 原生 Side Panel 展示本地保存的快捷话术。用户点击话术后，插件将话术文本插入当前招聘平台聊天输入框。

第一版只解决一个问题：

> 在招聘平台聊天页面中快速插入常用求职沟通话术。

## 2. Non-goals

第一版不实现以下能力：

* 不做 AI 生成话术
* 不读取岗位 JD
* 不读取简历
* 不读取聊天记录
* 不根据页面内容推荐话术
* 不自动发送消息
* 不自动点击发送按钮
* 不自动投递
* 不登录
* 不云同步
* 不服务端存储
* 不跨设备同步
* 不做投递记录管理
* 不做分类
* 不做标签
* 不做搜索
* 不做收藏
* 不做使用次数统计
* 不做拖拽排序
* 不做网页内悬浮侧边栏
* 不做 Chrome popup 主界面
* 不支持所有网页输入框

## 3. Supported Platforms

第一版目标支持以下招聘平台聊天输入框：

* BOSS直聘：`*.zhipin.com`
* 拉勾：`*.lagou.com`
* 智联招聘：`*.zhaopin.com`
* 前程无忧：`*.51job.com`
* 猎聘：`*.liepin.com`

P0 必须保证 BOSS直聘聊天页可用。

其他平台允许先提供基础 selector 兼容。

## 4. Extension UI

插件必须使用 Chrome 原生 Side Panel 作为唯一主界面。

用户点击插件图标后，必须打开 Side Panel。

Side Panel 必须展示：

* 话术卡片列表
* 新增话术入口
* 每条话术的编辑入口
* 每条话术的删除入口

Side Panel 不展示：

* 分类
* 标签
* 搜索框
* 收藏
* 使用次数
* 平台筛选

## 5. Snippet Behavior

每条话术只展示内容本身。

用户可以：

* 新增话术
* 编辑话术
* 删除话术
* 点击话术插入当前页面输入框

规则：

* 话术内容不能为空
* 保存前必须 trim 首尾空白
* 新增话术追加到列表末尾
* 编辑话术不改变排序
* 删除话术不改变其他话术顺序
* 删除话术前必须确认
* 默认话术可编辑
* 默认话术可删除
* 点击编辑按钮不得触发插入
* 点击删除按钮不得触发插入

## 6. Default Snippets

首次初始化时必须写入以下 3 条默认话术：

```txt
您好，我对这个岗位比较感兴趣，想进一步了解一下岗位情况。
```

```txt
您好，我主要有前端/全栈开发经验，熟悉 Vue3、TypeScript、Node.js，也有独立完成项目的经验，想和您进一步沟通一下。
```

```txt
您好，方便的话想跟进一下这个岗位的进展。如需补充简历、作品集或项目资料，我可以进一步提供。
```

初始化规则：

* 如果 storage 中不存在 snippets 数据，初始化默认话术
* 如果 storage 中 snippets 已存在但为空数组，不重新初始化默认话术

## 7. Data Model

```ts
type Snippet = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

type SnippetsStorage = {
  version: 1
  snippets: Snippet[]
}
```

字段要求：

* `id` 必须唯一
* `content` 为话术内容
* `createdAt` 为 ISO 字符串
* `updatedAt` 为 ISO 字符串

不得在第一版数据结构中加入：

* title
* category
* tags
* usedCount
* favorite
* platform

## 8. Storage

必须使用：

```txt
chrome.storage.local
```

数据只保存在浏览器本地。

不得请求远程接口。

不得上传话术内容。

不得使用服务端存储。

## 9. Message Protocol

Side Panel 向当前 active tab 发送插入消息。

消息格式：

```ts
type InsertSnippetMessage = {
  type: 'INSERT_SNIPPET'
  payload: {
    content: string
  }
}
```

Content Script 返回：

```ts
type InsertSnippetResponse = {
  ok: boolean
  reason?: string
}
```

要求：

* 只允许发送纯文本内容
* Content Script 不负责自动发送消息
* Content Script 必须返回插入结果

## 10. Insert Behavior

用户点击话术卡片主体后：

1. Side Panel 获取当前 active tab
2. Side Panel 向 Content Script 发送 `INSERT_SNIPPET`
3. Content Script 查找聊天输入框
4. 找到输入框后插入文本
5. 插入后触发输入事件
6. 插入成功后不自动发送消息
7. 插入失败时返回失败结果
8. Side Panel 收到失败结果后复制话术到剪贴板

成功行为：

* 文本插入聊天输入框
* 用户可继续编辑
* 插件不点击发送按钮
* 插件不展示提示

失败行为：

* 自动复制话术到剪贴板
* 插件不展示提示
* 插件不中断
* Side Panel 仍可继续使用

## 11. Input Detection

Content Script 必须支持以下输入元素：

* `textarea`
* `input`
* `[contenteditable="true"]`

输入框识别顺序：

1. 根据当前域名判断平台
2. 使用平台专用 selector
3. 如果失败，使用通用 selector
4. 只选择可见、可编辑、尺寸合理的元素
5. 找不到输入框则返回失败

插入要求：

* 插入前 focus 输入框
* 插入后触发 `input` 事件
* 必要时触发 `change` 事件
* contenteditable 插入后必须让页面框架感知文本变化

## 12. Permissions

Manifest 权限必须包含：

```json
{
  "permissions": [
    "storage",
    "sidePanel",
    "activeTab",
    "clipboardWrite"
  ],
  "host_permissions": [
    "*://*.zhipin.com/*",
    "*://*.lagou.com/*",
    "*://*.zhaopin.com/*",
    "*://*.51job.com/*",
    "*://*.liepin.com/*"
  ]
}
```

第一版使用声明式 `content_scripts`。

第一版不使用动态脚本注入。

第一版不需要 `scripting` 权限。

## 13. Architecture

推荐模块边界如下：

```txt
extension/
  manifest.json
  src/
    background/
      index.ts
    sidepanel/
      index.html
      main.tsx
      SidePanel.tsx
    content/
      index.ts
    shared/
      types.ts
      storage.ts
      defaultSnippets.ts
```

职责边界：

### Background

负责：

* 监听插件图标点击
* 打开 Chrome Side Panel

### Side Panel

负责：

* 展示话术列表
* 新增话术
* 编辑话术
* 删除话术
* 向当前 tab 发送插入消息
* 插入失败时复制话术到剪贴板

### Content Script

负责：

* 接收 `INSERT_SNIPPET`
* 判断当前平台
* 查找输入框
* 插入文本
* 返回插入结果

### Storage

负责：

* 初始化默认话术
* 读取话术
* 新增话术
* 更新话术
* 删除话术

## 14. Acceptance Criteria

### 14.1 Extension

* [ ] 插件符合 Chrome Extension Manifest V3
* [ ] 点击插件图标可以打开 Side Panel
* [ ] 插件不使用 Chrome popup 主界面
* [ ] 插件不请求远程接口

### 14.2 Default Data

* [ ] 首次打开 Side Panel 时显示 3 条默认话术
* [ ] 默认话术可编辑
* [ ] 默认话术可删除
* [ ] 用户删除所有话术后，刷新 Side Panel 不重新生成默认话术

### 14.3 Snippet Management

* [ ] 用户可以新增话术
* [ ] 新增话术追加到列表末尾
* [ ] 用户可以编辑话术
* [ ] 编辑话术不改变排序
* [ ] 用户可以删除话术
* [ ] 删除前出现确认
* [ ] 删除话术不影响其他话术顺序
* [ ] 空内容不能保存
* [ ] 保存内容会 trim 首尾空白
* [ ] 刷新页面后话术数据仍存在
* [ ] 重启浏览器后话术数据仍存在

### 14.4 Insert Behavior

* [ ] 在 BOSS直聘聊天页面点击话术后，文本可以插入聊天输入框
* [ ] 插入后不会自动发送消息
* [ ] 插入后用户可以继续编辑文本
* [ ] 点击编辑按钮不会触发插入
* [ ] 点击删除按钮不会触发插入
* [ ] 当前页面没有可用输入框时，话术会复制到剪贴板
* [ ] 插入失败不会导致 Side Panel 崩溃
* [ ] 插件不会读取聊天记录
* [ ] 插件不会上传话术内容

### 14.5 Input Types

* [ ] 支持插入 `textarea`
* [ ] 支持插入 `input`
* [ ] 支持插入 `contenteditable`
* [ ] 插入后页面可以感知输入变化

## 15. Priority

* MV3 插件基础结构
* Chrome Side Panel
* 本地话术存储
* 默认话术初始化
* 话术列表展示
* 新增话术
* 编辑话术
* 删除话术
* 删除确认
* 空内容校验
* 点击话术插入
* BOSS直聘输入框适配
* 插入失败复制到剪贴板
