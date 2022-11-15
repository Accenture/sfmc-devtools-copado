# Accenture Salesforce Marketing Cloud DevTools - Copado Edition

Next-level GUI for next-level professional Marketing Cloud DevOps!
Still in BETA - stay tuned for the first pilot release!

Based on the free & open-sourced [mcdev](https://github.com/Accenture/sfmc-devtools) and [Copado](https://www.copado.com/)!

Copyright (c) 2022 Accenture

## Recommended MCDEV config

Please ensure you limit retrievable types to only supported ones to reduce loading times and avoid errors during deployments:

```json
    "metaDataTypes": {
        "documentOnRetrieve": ["accountUser", "automation", "dataExtension", "role"],
        "retrieve": [
            "asset",
            "automation",
            "dataExtract",
            "fileTransfer",
            "importFile",
            "script",
            "query",
            "dataExtension",
            "role"
        ]
    },
```

## Required MCDEV version

We currently expect mcdev@4.1.12. Please ensure you use this version or higher if you plan to interact with your repo manually (outside of Copado).
