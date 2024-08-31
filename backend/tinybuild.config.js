const config = {
    //build:true, //enable this to skip serve step (same as cli)
    //serve:true //or enable this to skip build step (same as cli)
    bundler: { //esbuild settings, set false to skip build step or add bundle:true to config object to only bundle (alt methods)
        entryPoints: [ //entry point file(s). These can include .js, .mjs, .ts, .jsx, .tsx, or other javascript files. Make sure your entry point is a ts file if you want to generate types
            "contentserver.ts",
            "dataserver.ts"
        ],
        outdir: "./", //exit point file, will append .js as well as indicators like .esm.js, .node.js for other build flags
        //outdir:'dist'         //exit point folder, define for multiple entryPoints
        bundleBrowser: false, //create plain js build? Can include globals and init scripts
        bundleESM: false, //create esm module js files // { platform:'node' } //etc you can also supply an object here to add more specific esbuild settings
        bundleTypes: false, //create .d.ts files, //you need a .tsconfig for this to work
        bundleNode: true, //create node platform plain js build, specify platform:'node' to do the rest of the files 
        bundleHTML: false, //wrap the first entry point file as a plain js script in a boilerplate html file, frontend scripts can be run standalone like a .exe! Server serves this as start page if set to true.
        //bundleIIFE:false,   //create an iife build, this is compiled temporarily to create the types files and only saved with bundleIIFE:true
        //bundleCommonJS:false, //cjs format outputted as .cjs
        minify: true,
        sourcemap: false,
        platform:'node'
        //plugins:[] //custom esbuild plugins? e.g. esbuild-sass-plugin for scss support
        //includeDefaultPlugins:true //true by default, includes the presets for the streaming imports, worker bundling, and auto npm install
        //blobWorkers:true, //package workers as blobs or files? blobs are faster but inflate the main package size
        //workerBundler:{minifyWhitespace:true} //bundler settings specific to the worker. e.g. apply platform:'node' when bundling node workers, 
        //globalThis:null //'mymodule'
        //globals:{'index.js':['Graph']}
        //init:{'index.js':function(bundle) { console.log('prepackaged bundle script!', bundle); }.toString(); }      
        //  outputs:{ //overwrites main config settings for specific use cases
        //     node:{ //e.g. for bundleNode
        //     // external:[] //externals for node environment builds
        //     },
        //     //commonjs:{} //bundleCommonJS
        //     //browser:{}
        //     //esm:{}
        //     iife:{
        //     // external:[] //we only use the iife for types so it doesn't really matter if it bundles node, just note otherwise if you need iife for some obscure reason
        //     }
        // },
        
        //refer to esbuild docs for more settings
    }
}


module.exports = config; //es5  export default config; // 