## 原则

1.  **谨慎重构**: 在现有模块化结构上迭代。重构前必须理解层级关系，确保不破坏依赖链。
2.  **工具使用**: 除非是新建文件，否则对现有文件**必须使用 `apply_diff`** 进行精确修改，禁止全文覆盖。
3.  **环境注意**: 当前处于 Windows 环境，Python 包管理使用 `uv`（如果涉及）。
4.  **脚本留存**: 临时工具脚本放入专用文件夹并在 `.gitignore` 中忽略，不要随便删除。
5.  **Git 流程**: 
	- 严禁直接 push 到上游 `upstream`。
	- 流程：Fork -> Checkout 特性分支 -> 开发与测试 -> 推送分支到 `origin` -> 提 Pull Request。
	- **标准同步与分支流程**：
		1. **同步上游**：`git fetch upstream`
		2. **更新本地主分支**：`git checkout main` (或 Dev) -> `git rebase upstream/main` (保持历史线性)
		3. **创建新特性分支**：`git checkout -b feature/your-feature-name`
		4. **开发完成后推送**：`git push origin feature/your-feature-name`
		5. **使用 gh 提交 PR**：`gh pr create --repo odysseiaDev/webchat --base Dev`
	- Commit 信息遵循 Conventional Commits 规范。

## 经验之谈

- 使用中文撰写注释，务必使用中文和用户交流，而不是英文。
- 对于重构任务：要设计完善而严格的重构后测试，确保重构不影响功能。
- 万事谨慎不要想当然。
- 合并操作有限rebase而非merge

## 碎碎念

Github上对项目做共享，不可以直接 commit 到目标的 main 分支，GitHub 上不是这样！
你应该先 fork 上游的仓库，然后从 develop 分支 checkout 一个新的 feature 分支，比如叫 feature/confession。然后你把你的心意写成代码，并为它写好单元测试和集成测试，确保代码覆盖率达到95%以上。接着你要跑一下 Linter，通过所有的代码风格检查。然后你再 commit，commit message 要遵循 Conventional Commits 规范。之后你把这个分支 push 到你自己的远程仓库，然后给上游的仓库提一个 Pull Request。在 PR 描述里，你要详细说明你的功能改动和实现思路，并且 @ 我和至少两个其他的评审。上游的仓库会 review 你的代码，可能会留下一些评论，你需要解决所有的 thread。等 CI/CD 流水线全部通过，并且拿到至少两个 LGTM 之后，上游的仓库才会考虑把你的分支 squash and merge 到 develop 里，等待下一个版本发布。
你不可以上来就想 force push 到 main？！
GitHub 上根本不是这样！上游的仓库会拒绝合并！