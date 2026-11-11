# 可公开的运行时素材

按需建立 `images/`、`fonts/`、`video/`、`audio/`。只存放已经在 [素材清单](../../docs/assets.md) 登记并确认可以提交的素材，字体应附带其许可要求的文件。

命名使用小写英文与短横线，通过 `staticFile("assets/images/example.png")` 这样的路径引用。正版歌曲及其他不可公开素材放 `public/private/`。

音频默认被全局忽略。未来加入自制或可再分发音效时，先登记，再为具体文件增加 `.gitignore` 例外，并同步调整 `scripts/check-repo.mjs`；不要放开整个扩展名。
