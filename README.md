# Accenture Salesforce Marketing Cloud DevTools - Copado Edition

Next-level GUI for next-level professional Marketing Cloud DevOps!

Based on the free & open-sourced [mcdev](https://github.com/Accenture/sfmc-devtools) and [Copado](https://www.copado.com/)!

Copyright (c) 2022 Accenture

## Getting Started

### Recommended MCDEV config

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

### Required MCDEV version

We currently expect mcdev@4.1.12. Please ensure you use this version or higher if you plan to interact with your repo manually (outside of Copado).

## Contributors

The code is maintained by Accenture with support from Copado. If you want to contribute, simply clone the repo and create pull requests back to our repo's main branch. We will review your suggestion and once everything is OK, merge it into the main code base.

### Copado Functions

The bridge between [Accenture SFMC DevTools](https://github.com/Accenture/sfmc-devtools) and [Copado DevOps Platform](https://www.copado.com/) is written in [Node.js](https://nodejs.org/en/).

Its source code is located in **[/copado-function/app](https://github.com/Accenture/sfmc-devtools-copado/tree/master/copado-function/app)**. The main function files end on `.fn.js`. Shared classes are in the subfolder `common/` and type definitions are in the subfolder `types/`.

**Developer-Documentation** on each of the functions (generated from JSDoc) is saved in [/copado-function/docs/documentation.md](https://github.com/Accenture/sfmc-devtools-copado/blob/master/copado-function/docs/documentation.md).

The **[/copado-function/config](https://github.com/Accenture/sfmc-devtools-copado/tree/master/copado-function/config)** holds definitions on how Copado functions and also `System Properties` of various Salesforce objects should be set up in Copado to work properly.

#### Running functions

The files that shall be used on your server are auto-generated into **[/copado-function/dist](https://github.com/Accenture/sfmc-devtools-copado/tree/master/copado-function/dist)**. Do not edit files in here. Instead, run `npm run build` for a 1-time build or `npm run build:watch` to have a continuously running script in the background that updates the dist folder whenever you make changes to one of the source files in the app directory.

#### Debugging functions locally

Make sure you set up the environment files according to the samples provided in `/copado-function/app/environment/`. Please save a copy of the samples with file extension `.env` and add your test values.
Next, you can use VSCode's **Run and Debug** tab to start any of our functions and get the full debug output into your terminal. This relies on 2 mocks: [copado-git-get-mock](https://www.npmjs.com/package/copado-git-get-mock) and [copado](https://www.npmjs.com/package/copado-mock). Both need to be installed globally:

```bash
npm install -g copado-mock copado-git-get-mock
```

Running the function will create a local folder in `/copado-function/tmp/` into which the git repo of your project is cloned into.

**WARNING**: Please be aware that running **Init**, **Commit** and **Deploy** WILL make changes to your Git repo. Therefore, make sure you are using a test repo for it. Also be aware, that **Deploy** WILL make changes to your target business unit.

#### Docker Image

Copado uses Docker images to bundle necessary components like `mcdev` and make them available to our copado-functions. The image we use is defined in [/copado-function/app/images/Dockerfile](https://github.com/Accenture/sfmc-devtools-copado/tree/master/copado-function/app/images/Dockerfile)

### Salesforce configuration & code

The repo is set up as a normal Salesforce project, with the addition of the `/copado-functions` folder. You will find all deployable components in the standard folder `/force-app/main/default`.

Please ensure that any added components start with the prefix `mcdo_` to make them easily identifiable. It's an abbreviation for "Marketing Cloud DevOps".

When debugging in Salesforce, we advise using the packaged Salesforce App "Copado MCDev Contributor" for easy access to all relevant objects. Make sure that your user has the System Administrator profile to avoid issues during development and that you have assigned our Permission Set "Copado Marketing Cloud" to your user.

### Releasing a new version

Depending on the release, you need to run one of these commands:

- `npm run version:patch`
- `npm run version:minor`
- `npm run version:major`

followed by a manual execution of `git push` (that's done manually to give you a chance to opt-out of the release again in case it was run accidentally). Afterwards, please [create a new GitHub release](https://github.com/Accenture/sfmc-devtools-copado/releases/new), choosing the version-tag that the above created.
