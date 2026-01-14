# Pushable Tokens For FoundryVTT

## Notice:💓 Updated to Foundry V13!

Sum117: My changes aim to update this package to v13 foundry, using the new methods implemented in the new version. Not much has changed, just the way collision checks work.

If you want a foundry module revived, contact me through discord: masoria and I'll see what I can do.

If you like my work, please consider supporting me: https://ko-fi.com/sum117

Thank you [Leah Azure](https://github.com/LeahAzure) for the Foundry V12 update.

---

System agnostic.

## Installation

To set up, install the manifest below (or use the default Foundry installer), add some tokens, edit them (1) and mark them as pushable(2) and/or pullable(3).

![image](https://user-images.githubusercontent.com/8543541/160937714-1cc164bb-ee06-4bb7-a6c5-78081b15a387.png)

Install manually by adding the module manifest:

```
https://github.com/sum117/pushable/releases/download/10.0.4/module.json
```

## Localization
Current support for:
* English
* Brazilian Portuguese
* German

If you want to translate this module, download [this file](lang/en.json) and translate it. After that open an issue sharing your translation. Also share the default name convention for your language. You can find that by either, finding a system or module that is already translated to your language and open its module.json. It should look something like this:
`
"languages": [
      {
        "lang": "en",
        "name": "English",
        "path": "lang/en.json"
      }
`

## Demo

[![Sokoban puzzle using pushable tokens](http://img.youtube.com/vi/FOMEqN03SUU/0.jpg)](http://www.youtube.com/watch?v=FOMEqN03SUU "Sokoban video puzzle")


