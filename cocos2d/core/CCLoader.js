/****************************************************************************
 Copyright (c) 2010-2012 cocos2d-x.org
 Copyright (c) 2008-2010 Ricardo Quesada
 Copyright (c) 2011      Zynga Inc.

 http://www.cocos2d-x.org

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/

/**
 * resource type
 * @constant
 * @type Object
 */
cc.RESOURCE_TYPE = {
    "IMAGE": ["png", "jpg", "bmp", "jpeg", "gif"],
    "SOUND": ["mp3", "ogg", "wav", "mp4", "m4a"],
    "XML": ["plist", "xml", "fnt", "tmx", "tsx"],
    "BINARY": ["ccbi"],
    "FONT": "FONT",
    "TEXT": ["txt", "vsh", "fsh", "json", "ExportJson", "atlas"],
    "UNKNOW": []
};

/**
 * resource structure
 * @param resList
 * @param selector
 * @param target
 * @constructor
 */
cc.ResData = function (resList, selector, target) {
    this.resList = resList || [];
    this.selector = selector;
    this.target = target;
    this.curNumber = 0;
    this.loadedNumber = 0;
    this.totalNumber = this.resList.length;
};

/**
 * A class to preload resources async
 * @class
 * @extends cc.Class
 */
cc.Loader = cc.Class.extend(/** @lends cc.Loader# */{
    _curData: null,
    _resQueue: null,
    _isAsync: false,
    _scheduler: null,
    _running: false,
    _regisiterLoader: false,

    /**
     * Constructor
     */
    ctor: function () {
        this._scheduler = cc.Director.getInstance().getScheduler();
        this._resQueue = [];
    },

    /**
     * init with resources
     * @param {Array} resources
     * @param {Function|String} selector
     * @param {Object} target
     */
    initWithResources: function (resources, selector, target) {
        if (!resources) {
            cc.log("cocos2d:resources should not null");
            return;
        }
        var res = resources.concat([]);
        var data = new cc.ResData(res, selector, target);
        this._resQueue.push(data);

        if (!this._running) {
            this._running = true;
            this._curData = this._resQueue.shift();
            this._scheduler.scheduleUpdateForTarget(this);
        }
    },

    setAsync: function (isAsync) {
        this._isAsync = isAsync;
    },

    /**
     * Callback when a resource file loaded.
     */
    onResLoaded: function (err) {
        if(err != null){
            cc.log("cocos2d:Failed loading resource: " + err);
        }

        this._curData.loadedNumber++;
    },

    /**
     * Get loading percentage
     * @return {Number}
     * @example
     * //example
     * cc.log(cc.Loader.getInstance().getPercentage() + "%");
     */
    getPercentage: function () {
        var percent = 0, curData = this._curData;
        if (curData.totalNumber == 0) {
            percent = 100;
        }
        else {
            percent = (0 | (curData.loadedNumber / curData.totalNumber * 100));
        }
        return percent;
    },

    /**
     * release resources from a list
     * @param resources
     */
    releaseResources: function (resources) {
        if (resources && resources.length > 0) {
            var sharedTextureCache = cc.TextureCache.getInstance(),
                sharedEngine = cc.AudioEngine ? cc.AudioEngine.getInstance() : null,
                sharedParser = cc.SAXParser.getInstance(),
                sharedFileUtils = cc.FileUtils.getInstance();

            var resInfo, path, type;
            for (var i = 0; i < resources.length; i++) {
                resInfo = resources[i];
                path = typeof resInfo == "string" ? resInfo : resInfo.src;
                type = this._getResType(resInfo, path);

                switch (type) {
                    case "IMAGE":
                        sharedTextureCache.removeTextureForKey(path);
                        break;
                    case "SOUND":
                        if (!sharedEngine) throw "Can not find AudioEngine! Install it, please.";
                        sharedEngine.unloadEffect(path);
                        break;
                    case "XML":
                        sharedParser.unloadPlist(path);
                        break;
                    case "BINARY":
                        sharedFileUtils.unloadBinaryFileData(path);
                        break;
                    case "TEXT":
                        sharedFileUtils.unloadTextFileData(path);
                        break;
                    case "FONT":
                        this._unregisterFaceFont(resInfo);
                        break;
                    default:
                        throw "cocos2d:unknown filename extension: " + type;
                        break;
                }
            }
        }
    },

    update: function () {
        if (this._isAsync) {
            var frameRate = cc.Director.getInstance()._frameRate;
            if (frameRate != null && frameRate < 20) {
                cc.log("cocos2d: frame rate less than 20 fps, skip frame.");
                return;
            }
        }

        var curData = this._curData;
        if (curData && curData.curNumber < curData.totalNumber) {
            this._loadRes();
            curData.curNumber++;
        }

        var percent = this.getPercentage();
        if(percent >= 100){
            this._complete();
            if (this._resQueue.length > 0) {
                this._running = true;
                this._curData = this._resQueue.shift();
            }
            else{
                this._running = false;
                this._scheduler.unscheduleUpdateForTarget(this);
            }
        }
    },

    _loadRes: function () {
        var sharedTextureCache = cc.TextureCache.getInstance(),
            sharedEngine = cc.AudioEngine ? cc.AudioEngine.getInstance() : null,
            sharedParser = cc.SAXParser.getInstance(),
            sharedFileUtils = cc.FileUtils.getInstance();

        var resInfo = this._curData.resList.shift(),
            path = this._getResPath(resInfo),
            type = this._getResType(resInfo, path);

        switch (type) {
            case "IMAGE":
                sharedTextureCache.addImageAsync(path, this.onResLoaded, this);
                break;
            case "SOUND":
                if (!sharedEngine) throw "Can not find AudioEngine! Install it, please.";
                sharedEngine.preloadSound(path, this.onResLoaded, this);
                break;
            case "XML":
                sharedParser.preloadPlist(path, this.onResLoaded, this);
                break;
            case "BINARY":
                sharedFileUtils.preloadBinaryFileData(path, this.onResLoaded, this);
                break;
            case "TEXT" :
                sharedFileUtils.preloadTextFileData(path, this.onResLoaded, this);
                break;
            case "FONT":
                this._registerFaceFont(resInfo, this.onResLoaded, this);
                break;
            default:
                throw "cocos2d:unknown filename extension: " + type;
                break;
        }
    },

    _getResPath: function (resInfo) {
        return typeof resInfo == "string" ? resInfo : resInfo.src;
    },

    _getResType: function (resInfo, path) {
        var isFont = resInfo.fontName;
        if (isFont != null) {
            return cc.RESOURCE_TYPE["FONT"];
        }
        else {
            var ext = path.substring(path.lastIndexOf(".") + 1, path.length);
            var index = ext.indexOf("?");
            if (index > 0) ext = ext.substring(0, index);

            for (var resType in cc.RESOURCE_TYPE) {
                if (cc.RESOURCE_TYPE[resType].indexOf(ext) != -1) {
                    return resType;
                }
            }
            return ext;
        }
    },

    _complete: function () {
        cc.doCallback(this._curData.selector,this._curData.target);
    },

    _registerFaceFont: function (fontRes,seletor,target) {
        var srcArr = fontRes.src;
        var fileUtils = cc.FileUtils.getInstance();
        if (srcArr && srcArr.length > 0) {
            var fontStyle = document.createElement("style");
            fontStyle.type = "text/css";
            document.body.appendChild(fontStyle);

            var fontStr = "@font-face { font-family:" + fontRes.fontName + "; src:";
            for (var i = 0; i < srcArr.length; i++) {
                fontStr += "url('" + fileUtils.fullPathForFilename(encodeURI(srcArr[i].src)) + "') format('" + srcArr[i].type + "')";
                fontStr += (i == (srcArr.length - 1)) ? ";" : ",";
            }
            fontStyle.textContent += fontStr + "};";

            //preload
            //<div style="font-family: PressStart;">.</div>
            var preloadDiv = document.createElement("div");
            preloadDiv.style.fontFamily = fontRes.fontName;
            preloadDiv.innerHTML = ".";
            preloadDiv.style.position = "absolute";
            preloadDiv.style.left = "-100px";
            preloadDiv.style.top = "-100px";
            document.body.appendChild(preloadDiv);
        }
        cc.doCallback(seletor,target);
    },

    _unregisterFaceFont: function (fontRes) {
        //todo remove style
    }
});

/**
 * Preload resources in the background
 * @param {Array} resources
 * @param {Function|String} selector
 * @param {Object} target
 * @return {cc.Loader}
 * @example
 * //example
 * var g_mainmenu = [
 *    {src:"res/hello.png"},
 *    {src:"res/hello.plist"},
 *
 *    {src:"res/logo.png"},
 *    {src:"res/btn.png"},
 *
 *    {src:"res/boom.mp3"},
 * ]
 *
 * var g_level = [
 *    {src:"res/level01.png"},
 *    {src:"res/level02.png"},
 *    {src:"res/level03.png"}
 * ]
 *
 * //load a list of resources
 * cc.Loader.preload(g_mainmenu, this.startGame, this);
 *
 * //load multi lists of resources
 * cc.Loader.preload([g_mainmenu,g_level], this.startGame, this);
 */
cc.Loader.preload = function (resources, selector, target) {
    if (!this._instance) {
        this._instance = new cc.Loader();
    }
    this._instance.initWithResources(resources, selector, target);
    return this._instance;
};

/**
 * Preload resources async
 * @param {Array} resources
 * @param {Function|String} selector
 * @param {Object} target
 * @return {cc.Loader}
 */
cc.Loader.preloadAsync = function (resources, selector, target) {
    if (!this._instance) {
        this._instance = new cc.Loader();
    }
    this._instance.setAsync(true);
    this._instance.initWithResources(resources, selector, target);
    return this._instance;
};

/**
 * Release the resources from a list
 * @param {Array} resources
 */
cc.Loader.purgeCachedData = function (resources) {
    if (this._instance) {
        this._instance.releaseResources(resources);
    }
};

/**
 * Returns a shared instance of the loader
 * @function
 * @return {cc.Loader}
 */
cc.Loader.getInstance = function () {
    if (!this._instance) {
        this._instance = new cc.Loader();
    }
    return this._instance;
};

cc.Loader._instance = null;


/**
 * Used to display the loading screen
 * @class
 * @extends cc.Scene
 */
cc.LoaderScene = cc.Scene.extend(/** @lends cc.LoaderScene# */{
    _logo: null,
    _logoTexture: null,
    _texture2d: null,
    _bgLayer: null,
    _label: null,
    _winSize: null,

    /**
     * Constructor
     */
    ctor: function () {
        cc.Scene.prototype.ctor.call(this);
        this._winSize = cc.Director.getInstance().getWinSize();
    },
    init: function () {
        cc.Scene.prototype.init.call(this);
    },

    _initStage: function (centerPos) {
        this._texture2d = new cc.Texture2D();
        this._texture2d.initWithElement(this._logoTexture);
        this._texture2d.handleLoadedTexture();
        this._logo = cc.Sprite.createWithTexture(this._texture2d);
        this._logo.setScale(cc.CONTENT_SCALE_FACTOR());
        this._logo.setPosition(centerPos);
        this._bgLayer.addChild(this._logo, 10);
    },

    onEnter: function () {
        cc.Node.prototype.onEnter.call(this);
        this.schedule(this._startLoading, 0.3);
    },

    onExit: function () {
        cc.Node.prototype.onExit.call(this);
    },

    /**
     * init with resources
     * @param {Array} resources
     * @param {Function|String} selector
     * @param {Object} target
     */
    initWithResources: function (resources, selector, target) {
        this.resources = resources;
        this.selector = selector;
        this.target = target;
    },

    _startLoading: function () {
        this.unschedule(this._startLoading);
        cc.Loader.preload(this.resources, this.selector, this.target);
    }
});

/**
 * Preload multi scene resources.
 * @param {Array} resources
 * @param {Function|String} selector
 * @param {Object} target
 * @return {cc.LoaderScene}
 * @example
 * //example
 * var g_mainmenu = [
 *    {src:"res/hello.png"},
 *    {src:"res/hello.plist"},
 *
 *    {src:"res/logo.png"},
 *    {src:"res/btn.png"},
 *
 *    {src:"res/boom.mp3"},
 * ]
 *
 * var g_level = [
 *    {src:"res/level01.png"},
 *    {src:"res/level02.png"},
 *    {src:"res/level03.png"}
 * ]
 *
 * //load a list of resources
 * cc.LoaderScene.preload(g_mainmenu, this.startGame, this);
 *
 * //load multi lists of resources
 * cc.LoaderScene.preload([g_mainmenu,g_level], this.startGame, this);
 */
cc.LoaderScene.preload = function (resources, selector, target) {
    if (!this._instance) {
        this._instance = new cc.LoaderScene();
        this._instance.init();
    }

    this._instance.initWithResources(resources, selector, target);

    var director = cc.Director.getInstance();
    if (director.getRunningScene()) {
        director.replaceScene(this._instance);
    } else {
        director.runWithScene(this._instance);
    }

    return this._instance;
};
