.PHONY: help install build dev typecheck test test-watch clean all

help: ## 显示帮助信息
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## 安装依赖
	pnpm install

build: ## 构建生产版本 (extension/dist/)
	pnpm build

dev: ## 启动开发服务器
	pnpm dev

typecheck: ## TypeScript 类型检查
	pnpm typecheck

test: ## 运行所有测试
	pnpm test

test-watch: ## 监听模式运行测试
	pnpm test:watch

clean: ## 清理构建产物和依赖
	rm -rf extension/dist node_modules

all: install typecheck test build ## 完整构建流程（安装 → 类型检查 → 测试 → 构建）
