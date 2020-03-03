!function(e,a){for(var i in a)e[i]=a[i]}(window,function(modules){var installedModules={};function __webpack_require__(moduleId){if(installedModules[moduleId])return installedModules[moduleId].exports;var module=installedModules[moduleId]={i:moduleId,l:!1,exports:{}};return modules[moduleId].call(module.exports,module,module.exports,__webpack_require__),module.l=!0,module.exports}return __webpack_require__.m=modules,__webpack_require__.c=installedModules,__webpack_require__.d=function(exports,name,getter){__webpack_require__.o(exports,name)||Object.defineProperty(exports,name,{enumerable:!0,get:getter})},__webpack_require__.r=function(exports){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(exports,"__esModule",{value:!0})},__webpack_require__.t=function(value,mode){if(1&mode&&(value=__webpack_require__(value)),8&mode)return value;if(4&mode&&"object"==typeof value&&value&&value.__esModule)return value;var ns=Object.create(null);if(__webpack_require__.r(ns),Object.defineProperty(ns,"default",{enumerable:!0,value:value}),2&mode&&"string"!=typeof value)for(var key in value)__webpack_require__.d(ns,key,function(key){return value[key]}.bind(null,key));return ns},__webpack_require__.n=function(module){var getter=module&&module.__esModule?function(){return module.default}:function(){return module};return __webpack_require__.d(getter,"a",getter),getter},__webpack_require__.o=function(object,property){return Object.prototype.hasOwnProperty.call(object,property)},__webpack_require__.p="lib/server/build/",__webpack_require__(__webpack_require__.s=3)}([function(module,exports){module.exports=function(obj){if(obj&&obj.__esModule)return obj;var newObj={};if(null!=obj)for(var key in obj)if(Object.prototype.hasOwnProperty.call(obj,key)){var desc=Object.defineProperty&&Object.getOwnPropertyDescriptor?Object.getOwnPropertyDescriptor(obj,key):{};desc.get||desc.set?Object.defineProperty(newObj,key,desc):newObj[key]=obj[key]}return newObj.default=obj,newObj}},function(module,exports){module.exports=window.TBUtils},function(module,exports){module.exports=function(obj){return obj&&obj.__esModule?obj:{default:obj}}},function(module,exports,__webpack_require__){"use strict";var _interopRequireWildcard=__webpack_require__(0);__webpack_require__(4);var serverApplication=_interopRequireWildcard(__webpack_require__(9));module.exports=serverApplication},function(module,exports,__webpack_require__){var content=__webpack_require__(5);"string"==typeof content&&(content=[[module.i,content,""]]);var options={hmr:!0,transform:void 0,insertInto:void 0};__webpack_require__(7)(content,options);content.locals&&(module.exports=content.locals)},function(module,exports,__webpack_require__){(module.exports=__webpack_require__(6)(!1)).push([module.i,".servicedoc-filter-p {\n  margin-bottom: 0.6em; }\n\n.servicedoc-filter-categories {\n  display: inline-block;\n  text-align: center;\n  width: 1.6em; }\n\n.servicedoc-filter-categories-results-form {\n  margin-bottom: 0.6em;\n  text-indent: -1.6em;\n  padding-left: 1.6em; }\n\n.servicedoc-filter-categories-results-form-comment {\n  color: #999; }\n\n.servicedoc-graph-view-module-views {\n  padding-bottom: 32px; }\n\n.servicedoc-graph-view-module-views-top {\n  padding-top: 32px; }\n\n.servicedoc-index-doc-page {\n  margin: 2em 2.5em; }\n\n.servicedoc-index-hr {\n  margin-top: 1em; }\n\n.servicedoc-service-syntax-padding-left {\n  padding-left: 32px; }\n\n.servicedoc-filter-checkbox {\n  width: 1.4em; }\n\nth.ArgumentsTH {\n  border: thin solid #8888aa;\n  border-width: thin;\n  border-color: #8888aa;\n  padding: 3px;\n  text-align: center; }\n\n.auth-role-group-ul {\n  list-style: none;\n  padding: 0;\n  margin: 0; }\n\n.auth-role-group-li {\n  margin-bottom: 10px; }\n\n.auth-role-group-a:link {\n  color: #999999;\n  text-decoration: none; }\n\n.auth-role-group-a:hover {\n  text-decoration: underline; }\n\n.auth-role-group-selected-a {\n  text-decoration: none;\n  background-color: grey;\n  color: white !important;\n  font-weight: bold; }\n\n/*\nThis prevents long Resource names from pushing everything off the page.\nIf this DOM is reworked and the Resource is removed from the 2 location this will not work.\n*/\n#roleEditorAssetList tr td:nth-of-type(2) {\n  max-width: 620px;\n  word-wrap: break-word; }\n\n#roleEditorAssetList .checkbox {\n  margin-top: -9px; }\n\n#roleEditorAssetList a {\n  margin-top: 1px; }\n\n.no-top-border-th {\n  border-top-width: 0px;\n  border-top-style: none;\n  border-top-color: white; }\n\n/* A copy of css/console.css, scoped so that it only applies to the\n   content section of pgadmin:RoleEditorPage. Most of this is not\n   even needed here. We should get rid of this. We only need a bit\n   of table styling. */\n.pgadmin {\n  /* Forms */\n  /* Content Panel */\n  /* Tables */ }\n  .pgadmin p {\n    font-size: 14px;\n    color: #999999;\n    margin-top: 0px;\n    margin-right: 0px;\n    margin-bottom: 10px;\n    margin-left: 0px; }\n  .pgadmin .feedback {\n    font-style: italic;\n    color: #ff2222; }\n  .pgadmin .footer {\n    font-size: 12px;\n    color: #cccccc;\n    line-height: 18px;\n    margin-top: 5px;\n    margin-bottom: 0px; }\n  .pgadmin .version {\n    font-size: 12px;\n    color: #cccccc;\n    line-height: 18px;\n    margin-top: 5px;\n    margin-bottom: 0px;\n    margin-right: 0px;\n    margin-left: 0px; }\n  .pgadmin a:link {\n    color: #999999; }\n  .pgadmin a:visited {\n    color: #999999; }\n  .pgadmin a:hover {\n    color: #990000; }\n  .pgadmin a:active {\n    color: #990000; }\n  .pgadmin h1 {\n    font-size: 20px;\n    color: #73c2e2;\n    margin-bottom: 0px;\n    padding-bottom: 0px; }\n  .pgadmin a:link.h1 {\n    color: #73c2e2; }\n  .pgadmin a:visited.h1 {\n    color: #73c2e2; }\n  .pgadmin a:hover.h1 {\n    color: #990000; }\n  .pgadmin a:active.h1 {\n    color: #990000; }\n  .pgadmin h2 {\n    font-size: 16px;\n    font-weight: bold;\n    color: #73c2e2;\n    margin-bottom: 0px;\n    padding-bottom: 0px;\n    font-variant: normal;\n    line-height: 22px; }\n  .pgadmin a:link.h2 {\n    color: #73c2e2; }\n  .pgadmin a:visited.h2 {\n    color: #73c2e2; }\n  .pgadmin a:hover.h2 {\n    color: #990000; }\n  .pgadmin a:active.h2 {\n    color: #990000; }\n  .pgadmin h3 {\n    font-size: 14px;\n    font-weight: bold;\n    color: #73c2e2;\n    font-variant: normal;\n    line-height: 20px; }\n  .pgadmin .smallCopy {\n    font-size: 12px;\n    color: #666666;\n    padding-bottom: 10px;\n    line-height: 18px; }\n  .pgadmin ul.apps {\n    margin-left: 0px;\n    padding-left: 0px;\n    margin-top: 5px; }\n  .pgadmin li.apps {\n    font-size: 12px;\n    color: #666666;\n    line-height: 18px;\n    background-color: #fff8e9;\n    padding: 5px;\n    width: 400px;\n    margin-left: 0px;\n    text-align: left;\n    list-style-image: none;\n    list-style-type: none;\n    list-style-position: outside;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #ffffff; }\n  .pgadmin li.appslist {\n    font-size: 12px;\n    color: #666666;\n    line-height: 18px;\n    background-color: #fff8e9;\n    padding: 5px;\n    margin-left: 0px;\n    text-align: left;\n    list-style-image: none;\n    list-style-type: none;\n    list-style-position: outside;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #ffffff; }\n  .pgadmin ul.appslist {\n    -webkit-padding-start: 0; }\n  .pgadmin .appslist > table {\n    table-layout: fixed;\n    width: 100%; }\n  .pgadmin td.appslist {\n    width: fit-content;\n    word-wrap: break-word; }\n  .pgadmin .appslist table tr th:nth-child(3) {\n    text-align: right; }\n  .pgadmin .appslist table tr td:nth-child(3) {\n    text-align: right; }\n  .pgadmin .appslist table tr th:nth-child(2) {\n    width: 400px; }\n  .pgadmin .copy {\n    font-size: 16px;\n    line-height: 20px;\n    color: #666666;\n    padding-bottom: 14px; }\n  .pgadmin .copyHILITE {\n    font-size: 16px;\n    line-height: 20px;\n    color: #ff0000;\n    padding-bottom: 14px; }\n  .pgadmin form {\n    padding: 0px;\n    margin-top: 5px;\n    margin-right: 0px;\n    margin-bottom: 0px;\n    margin-left: 0px; }\n  .pgadmin td.form {\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #cccccc; }\n  .pgadmin .formLabel {\n    font-size: 12px;\n    color: #666666; }\n  .pgadmin td.appslist {\n    font-size: 12px;\n    color: #666666;\n    line-height: 18px;\n    background-color: #fff8e9;\n    padding: 5px;\n    margin-left: 0px;\n    text-align: left;\n    list-style-image: none;\n    list-style-type: none;\n    list-style-position: outside;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #ffffff; }\n  .pgadmin th.appslist {\n    font-size: 12px;\n    color: #666666;\n    line-height: 18px;\n    background-color: #fff8e9;\n    padding: 5px;\n    margin-left: 0px;\n    text-align: left;\n    list-style-image: none;\n    list-style-type: none;\n    list-style-position: outside;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #ffffff; }\n  .pgadmin th {\n    font-size: 12px;\n    font-weight: bold;\n    color: #999999;\n    text-align: left;\n    padding: 5px;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #cccccc; }\n  .pgadmin .tableCopy {\n    font-size: 12px;\n    color: #999999; }\n  .pgadmin td.rule {\n    padding: 5px;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #cccccc; }\n  .pgadmin td.dict {\n    font-size: 12px;\n    color: #333333;\n    text-align: left;\n    padding: 5px;\n    border-top-width: 1px;\n    border-top-style: solid;\n    border-top-color: #cccccc; }\n  .pgadmin .aborted {\n    font-size: 12px;\n    color: #ff0000;\n    font-weight: bold; }\n\n.roleContainer {\n  display: inline-flex;\n  align-items: center; }\n  .roleContainer .form-control {\n    height: 37px; }\n\n/* Styles for the TBL UI page style */\n/* General typography */\nh2 {\n  font-size: 16px;\n  font-weight: bold;\n  color: #245; }\n\nh3 {\n  color: #005a9c;\n  font-size: 16px; }\n  h3:first-child {\n    margin-top: 6px; }\n\na {\n  cursor: pointer; }\n  a:hover {\n    color: #900000; }\n\ncode {\n  color: #254ec7;\n  background-color: #f2f4f9; }\n\npre {\n  /* We want horizontal scroll bars for long lines */\n  white-space: pre;\n  overflow: auto;\n  word-wrap: normal; }\n\n/* Utilities */\n.table-nonfluid {\n  width: auto !important; }\n\n/* Page setup & header & footer */\nbody {\n  background: #f6f6f6;\n  margin: 20px 32px 32px;\n  min-height: 100vh;\n  /* Set these to their default values to override teamwork.css */\n  min-width: auto;\n  position: static; }\n\nbody > header > .logo {\n  float: left;\n  background: #fff;\n  border-radius: 8px;\n  padding: 6px 14px 0px 6px;\n  height: 64px;\n  margin-right: 15px; }\n  body > header > .logo:hover {\n    background: #ffd; }\n\nbody > header > .admin-link {\n  float: left;\n  width: 64px;\n  height: 64px;\n  margin-right: 15px; }\n  body > header > .admin-link a {\n    display: block;\n    width: 100%;\n    height: 100%;\n    color: white;\n    background: #204d74;\n    border-radius: 8px;\n    text-align: center;\n    font-size: 40px;\n    padding-top: 2px;\n    box-shadow: 1px 1px 8px #ccc; }\n    body > header > .admin-link a:hover {\n      color: yellow;\n      background: #900000; }\n\nbody > header > h1 {\n  vertical-align: top;\n  background: #fff;\n  border-radius: 8px;\n  min-height: 64px;\n  color: #245;\n  font-size: 22px;\n  font-weight: bold;\n  margin: 0;\n  padding: 17px 20px 17px;\n  overflow: hidden;\n  box-shadow: 1px 1px 8px #ccc; }\n\nbody > header > .username {\n  position: absolute;\n  top: 20px;\n  right: 32px;\n  padding: 3px 8px 0 0;\n  font-size: 12px;\n  color: #999; }\n  body > header > .username i {\n    font-size: 10px;\n    vertical-align: 1px; }\n  body > header > .username a {\n    color: #999; }\n\nbody > header.home > h1 {\n  color: white;\n  background: #204d74; }\n\nbody > header.home > h1 i {\n  float: left;\n  font-size: 30px;\n  position: relative;\n  top: -3px;\n  margin-right: 8px; }\n\nbody > header.home > .username {\n  color: #ccc; }\n  body > header.home > .username a {\n    color: #ccc; }\n    body > header.home > .username a:hover {\n      color: yellow; }\n\nbody > footer {\n  font-size: 12px;\n  text-align: right;\n  padding: 0 6px 0 2px;\n  color: #ccc; }\n  body > footer .copyright {\n    float: left; }\n  body > footer .support,\n  body > footer .send-log {\n    margin-left: 40px; }\n  body > footer a {\n    color: #999; }\n\n/* tblui:Section and tblui:FormSection */\n.tblui-section {\n  border-radius: 8px;\n  box-shadow: 1px 1px 8px #888;\n  margin: 20px 0 40px; }\n  .tblui-section:last-child {\n    margin-bottom: 12px; }\n  .tblui-section:not(.bg-primary):not(.bg-success):not(.bg-info):not(.bg-warning):not(.bg-danger) {\n    background: white; }\n  .tblui-section > h2 {\n    color: white;\n    background: #204d74;\n    font-size: 16px;\n    font-weight: 600;\n    margin: 0;\n    line-height: inherit;\n    border-top-left-radius: 7px;\n    border-top-right-radius: 7px;\n    padding: 7px 12px; }\n  .tblui-section > .action-bar {\n    border-top: none; }\n  .tblui-section > .content:not(:empty) {\n    padding: 12px; }\n  .tblui-section .swa-form {\n    padding: 12px; }\n\n/* Lists of links on the Server Administration homepage and elsewhere */\nul.tblui-links {\n  padding-left: 20px;\n  margin: 0.4em 0 1.4em; }\n  ul.tblui-links li {\n    color: #245;\n    line-height: 1.5em; }\n",""])},function(module,exports,__webpack_require__){"use strict";module.exports=function(useSourceMap){var list=[];return list.toString=function(){return this.map(function(item){var content=function(item,useSourceMap){var content=item[1]||"",cssMapping=item[3];if(!cssMapping)return content;if(useSourceMap&&"function"==typeof btoa){var sourceMapping=function(sourceMap){return"/*# sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))))+" */"}(cssMapping),sourceURLs=cssMapping.sources.map(function(source){return"/*# sourceURL="+cssMapping.sourceRoot+source+" */"});return[content].concat(sourceURLs).concat([sourceMapping]).join("\n")}return[content].join("\n")}(item,useSourceMap);return item[2]?"@media "+item[2]+"{"+content+"}":content}).join("")},list.i=function(modules,mediaQuery){"string"==typeof modules&&(modules=[[null,modules,""]]);for(var alreadyImportedModules={},i=0;i<this.length;i++){var id=this[i][0];null!=id&&(alreadyImportedModules[id]=!0)}for(i=0;i<modules.length;i++){var item=modules[i];null!=item[0]&&alreadyImportedModules[item[0]]||(mediaQuery&&!item[2]?item[2]=mediaQuery:mediaQuery&&(item[2]="("+item[2]+") and ("+mediaQuery+")"),list.push(item))}},list}},function(module,exports,__webpack_require__){var fn,memo,stylesInDom={},isOldIE=(fn=function(){return window&&document&&document.all&&!window.atob},function(){return void 0===memo&&(memo=fn.apply(this,arguments)),memo}),getElement=function(){var memo={};return function(target,parent){if("function"==typeof target)return target();if(void 0===memo[target]){var styleTarget=function(target,parent){return parent?parent.querySelector(target):document.querySelector(target)}.call(this,target,parent);if(window.HTMLIFrameElement&&styleTarget instanceof window.HTMLIFrameElement)try{styleTarget=styleTarget.contentDocument.head}catch(e){styleTarget=null}memo[target]=styleTarget}return memo[target]}}(),singleton=null,singletonCounter=0,stylesInsertedAtTop=[],fixUrls=__webpack_require__(8);function addStylesToDom(styles,options){for(var i=0;i<styles.length;i++){var item=styles[i],domStyle=stylesInDom[item.id];if(domStyle){domStyle.refs++;for(var j=0;j<domStyle.parts.length;j++)domStyle.parts[j](item.parts[j]);for(;j<item.parts.length;j++)domStyle.parts.push(addStyle(item.parts[j],options))}else{var parts=[];for(j=0;j<item.parts.length;j++)parts.push(addStyle(item.parts[j],options));stylesInDom[item.id]={id:item.id,refs:1,parts:parts}}}}function listToStyles(list,options){for(var styles=[],newStyles={},i=0;i<list.length;i++){var item=list[i],id=options.base?item[0]+options.base:item[0],part={css:item[1],media:item[2],sourceMap:item[3]};newStyles[id]?newStyles[id].parts.push(part):styles.push(newStyles[id]={id:id,parts:[part]})}return styles}function insertStyleElement(options,style){var target=getElement(options.insertInto);if(!target)throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");var lastStyleElementInsertedAtTop=stylesInsertedAtTop[stylesInsertedAtTop.length-1];if("top"===options.insertAt)lastStyleElementInsertedAtTop?lastStyleElementInsertedAtTop.nextSibling?target.insertBefore(style,lastStyleElementInsertedAtTop.nextSibling):target.appendChild(style):target.insertBefore(style,target.firstChild),stylesInsertedAtTop.push(style);else if("bottom"===options.insertAt)target.appendChild(style);else{if("object"!=typeof options.insertAt||!options.insertAt.before)throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");var nextSibling=getElement(options.insertAt.before,target);target.insertBefore(style,nextSibling)}}function removeStyleElement(style){if(null===style.parentNode)return!1;style.parentNode.removeChild(style);var idx=stylesInsertedAtTop.indexOf(style);0<=idx&&stylesInsertedAtTop.splice(idx,1)}function createStyleElement(options){var style=document.createElement("style");if(void 0===options.attrs.type&&(options.attrs.type="text/css"),void 0===options.attrs.nonce){var nonce=function(){0;return __webpack_require__.nc}();nonce&&(options.attrs.nonce=nonce)}return addAttrs(style,options.attrs),insertStyleElement(options,style),style}function addAttrs(el,attrs){Object.keys(attrs).forEach(function(key){el.setAttribute(key,attrs[key])})}function addStyle(obj,options){var style,update,remove,result;if(options.transform&&obj.css){if(!(result="function"==typeof options.transform?options.transform(obj.css):options.transform.default(obj.css)))return function(){};obj.css=result}if(options.singleton){var styleIndex=singletonCounter++;style=singleton=singleton||createStyleElement(options),update=applyToSingletonTag.bind(null,style,styleIndex,!1),remove=applyToSingletonTag.bind(null,style,styleIndex,!0)}else remove=obj.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(style=function(options){var link=document.createElement("link");return void 0===options.attrs.type&&(options.attrs.type="text/css"),options.attrs.rel="stylesheet",addAttrs(link,options.attrs),insertStyleElement(options,link),link}(options),update=function(link,options,obj){var css=obj.css,sourceMap=obj.sourceMap,autoFixUrls=void 0===options.convertToAbsoluteUrls&&sourceMap;(options.convertToAbsoluteUrls||autoFixUrls)&&(css=fixUrls(css));sourceMap&&(css+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap))))+" */");var blob=new Blob([css],{type:"text/css"}),oldSrc=link.href;link.href=URL.createObjectURL(blob),oldSrc&&URL.revokeObjectURL(oldSrc)}.bind(null,style,options),function(){removeStyleElement(style),style.href&&URL.revokeObjectURL(style.href)}):(style=createStyleElement(options),update=function(style,obj){var css=obj.css,media=obj.media;media&&style.setAttribute("media",media);if(style.styleSheet)style.styleSheet.cssText=css;else{for(;style.firstChild;)style.removeChild(style.firstChild);style.appendChild(document.createTextNode(css))}}.bind(null,style),function(){removeStyleElement(style)});return update(obj),function(newObj){if(newObj){if(newObj.css===obj.css&&newObj.media===obj.media&&newObj.sourceMap===obj.sourceMap)return;update(obj=newObj)}else remove()}}module.exports=function(list,options){if("undefined"!=typeof DEBUG&&DEBUG&&"object"!=typeof document)throw new Error("The style-loader cannot be used in a non-browser environment");(options=options||{}).attrs="object"==typeof options.attrs?options.attrs:{},options.singleton||"boolean"==typeof options.singleton||(options.singleton=isOldIE()),options.insertInto||(options.insertInto="head"),options.insertAt||(options.insertAt="bottom");var styles=listToStyles(list,options);return addStylesToDom(styles,options),function(newList){for(var mayRemove=[],i=0;i<styles.length;i++){var item=styles[i];(domStyle=stylesInDom[item.id]).refs--,mayRemove.push(domStyle)}newList&&addStylesToDom(listToStyles(newList,options),options);for(i=0;i<mayRemove.length;i++){var domStyle;if(0===(domStyle=mayRemove[i]).refs){for(var j=0;j<domStyle.parts.length;j++)domStyle.parts[j]();delete stylesInDom[domStyle.id]}}}};var textStore,replaceText=(textStore=[],function(index,replacement){return textStore[index]=replacement,textStore.filter(Boolean).join("\n")});function applyToSingletonTag(style,index,remove,obj){var css=remove?"":obj.css;if(style.styleSheet)style.styleSheet.cssText=replaceText(index,css);else{var cssNode=document.createTextNode(css),childNodes=style.childNodes;childNodes[index]&&style.removeChild(childNodes[index]),childNodes.length?style.insertBefore(cssNode,childNodes[index]):style.appendChild(cssNode)}}},function(module,exports){module.exports=function(css){var location="undefined"!=typeof window&&window.location;if(!location)throw new Error("fixUrls requires window.location");if(!css||"string"!=typeof css)return css;var baseUrl=location.protocol+"//"+location.host,currentDir=baseUrl+location.pathname.replace(/\/[^\/]*$/,"/");return css.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,function(fullMatch,origUrl){var newUrl,unquotedOrigUrl=origUrl.trim().replace(/^"(.*)"$/,function(o,$1){return $1}).replace(/^'(.*)'$/,function(o,$1){return $1});return/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(unquotedOrigUrl)?fullMatch:(newUrl=0===unquotedOrigUrl.indexOf("//")?unquotedOrigUrl:0===unquotedOrigUrl.indexOf("/")?baseUrl+unquotedOrigUrl:currentDir+unquotedOrigUrl.replace(/^\.\//,""),"url("+JSON.stringify(newUrl)+")")})}},function(module,exports,__webpack_require__){"use strict";var _interopRequireDefault=__webpack_require__(2),_pgadmin=_interopRequireDefault(__webpack_require__(10)),_pwadmin=_interopRequireDefault(__webpack_require__(11)),_servicedoc=_interopRequireDefault(__webpack_require__(13)),_tbladmin=_interopRequireDefault(__webpack_require__(14)),_tblui=_interopRequireDefault(__webpack_require__(15));module.exports={pgadmin:_pgadmin.default,pwadmin:_pwadmin.default,servicedoc:_servicedoc.default,tbladmin:_tbladmin.default,tblui:_tblui.default}},function(module,exports,__webpack_require__){"use strict";exports.__esModule=!0,exports.default=void 0;var _utils=__webpack_require__(1),pgadmin={addAssetsFromTreeToGroup:function(groupName,withImports){var params,$checkedAssets,assetId;if(0<groupName.length&&(params={group:groupName},0<($checkedAssets=$(".jstree-clicked")).length)){null!=withImports&&(params.withImports=withImports),(10<$checkedAssets.length||withImports)&&swa.insertLoadingIndicator($("#roleEditorAssetList"));var params2=new URLSearchParams(params);$checkedAssets.each(function(index,checkedAssetElement){assetId=$(checkedAssetElement).parent().attr("data-resource"),params2.append("assets[]",assetId)}),_utils.axiosInstance.post(swa.server+"addAssetsToGroup",params2).then(function(){swa.load("roleEditorAssetList")}).catch(function(err){console.log(err)})}},addAssetsToGroup:function(assetIds,assetFamilies,groupName,withImports){if(0<assetIds.length&&0<assetFamilies.length&&0<groupName.length)return null!=withImports&&null!=withImports&&(params.withImports=withImports)&&swa.insertLoadingIndicator($("#roleEditorAssetList")),_utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:AddAssetsToGroupService",assets:assetIds,families:assetFamilies,group:groupName}}).then(function(response){swa.load("roleEditorAssetList")}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},addGroupToRole:function(groupName,roleName){if(0<groupName.length){if("_newGroup_"!=groupName)return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:AddRoleToGroupService",role:roleName,group:groupName}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+escape(roleName)+"&selectedGroup="+escape(groupName)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)});pgadmin.openCreateNewGroupDialog(),swa.load("roleEditorAddGroup")}},addRoleToGroup:function(roleName,groupName){if(0<roleName.length){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:AddRoleToGroupService",role:roleName,group:groupName}}).then(function(response){swa.load("groupEditorRoleList"),swa.load("groupEditorAddRole")}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})}},assetTreeCheck:function(){var $nextBtn=$("#selectAssetsTreeDialogNext"),$addBtn=$("#selectAssetsTreeDialogAddAssets");void 0!==$nextBtn.button("instance")&&void 0!==$addBtn.button("instance")?($nextBtn.button("enable"),$addBtn.button("enable")):console.warn("No instance of button, cannot enable")},assetTreeUncheck:function(){var checkedAssetCount=$(".jstree-clicked").length,$nextBtn=$("#selectAssetsTreeDialogNext"),$addBtn=$("#selectAssetsTreeDialogAddAssets");0===checkedAssetCount&&(void 0!==$nextBtn.button("instance")&&$addBtn.button("instance")?($nextBtn.button("disable"),$addBtn.button("disable")):console.warn("No instance of button found, cannot disable"))},copyGroup:function(roleName,oldName,newName){if(0<roleName.length&&0<oldName.length&&0<newName.length)return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:CopyPermissionGroupService",oldGroup:oldName,newGroup:newName}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+roleName+"&selectedGroup="+escape(newName)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},createNewGroup:function(roleName,groupName){if(0<roleName.length&&0<groupName.length)return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:CreateNewPermissionGroupService",role:roleName,group:groupName,_format:"json"}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+escape(roleName)+"&selectedGroup="+escape(groupName)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},deleteGroup:function(roleName,groupName){var deleteConfirmed=swa.populateConfirmDialog("Delete group "+groupName+"?");Promise.resolve(deleteConfirmed).then(function(){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:DeletePermissionGroupService",group:groupName}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+roleName}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},initTree:function initTree(id,link,onLoaded,onCheck,onUncheck){var $tree=$("#"+id),plugins=["checkbox"],link=swa.redirectLink(link),params,$whatHappened;""!=swa.server&&(link+="&_server="+escape(swa.server)),params={plugins:plugins,core:{animation:200,themes:{stripes:!1},data:{dataType:"json",method:"get",contentType:"application/json",url:function(node){return link},data:function(node){return{id:"#"===node.id?"1":node.id,_bypassCacheDummy:(new Date).getTime()}}}}},$tree.jstree(params),(onCheck||onUncheck)&&$tree.on("changed.jstree",function(event,data){$whatHappened=data.action,"select_node"===$whatHappened?eval(onCheck):"deselect_node"===$whatHappened&&eval(onUncheck)}),onLoaded&&$tree.on("loaded.jstree",function(event,data){eval(onLoaded)})},openAddAssetWildcardDialog:function(){$("#addAssetWildcardDialog").dialog("open")},openCopyGroupDialog:function(){$("#copyGroupDialog").dialog("open")},openCreateNewGroupDialog:function(){$("#createNewGroupDialog").dialog("open")},openRenameGroupDialog:function(){$("#renameGroupDialog").dialog("open")},openSelectAssetsTreeDialog:function(params){null!=params&&null!=params&&swa.load("selectAssetsTreeDialogAssetTree",params),$("#selectAssetsTreeDialog").dialog("open")},openSelectImportClosureForTreeDialog:function(params){swa.load("selectImportClosureForTreeDialogAssets",params),$("#selectImportClosureForTreeDialog").dialog("open")},removeAssetFromGroup:function(assetId,groupName){var removeConfirmed=swa.populateConfirmDialog("Remove resource "+assetId+" from group "+groupName+"?");Promise.resolve(removeConfirmed).then(function(){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:RemoveAssetFromGroupService",asset:assetId,group:groupName}}).then(function(response){swa.load("roleEditorAssetList")}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},removeRoleFromGroup:function(roleName,groupName){var removeConfirmed=swa.populateConfirmDialog("Remove role "+roleName+" from group "+groupName+"?");Promise.resolve(removeConfirmed).then(function(){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:RemoveRoleFromGroupService",role:roleName,group:groupName}}).then(function(response){swa.load("groupEditorRoleList"),swa.load("groupEditorAddRole")}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},removeGroupFromRole:function(roleName,groupName){var removeConfirmed=swa.populateConfirmDialog("Remove group "+groupName+" from role "+roleName+"?");Promise.resolve(removeConfirmed).then(function(){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:RemoveRoleFromGroupService",role:roleName,group:groupName}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+roleName}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},renameGroup:function(roleName,oldName,newName){if(0<roleName.length&&0<oldName.length&&0<newName.length){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:RenamePermissionGroupService",oldGroup:oldName,newGroup:newName}}).then(function(response){window.location="swp?_viewClass=pgadmin:RoleEditorPage&selectedRole="+roleName+"&selectedGroup="+escape(newName)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})}},setAssetPermission:function(checkBoxElement,assetID,assetPermission,permissionGroup){return _utils.axiosInstance.get(swa.server+swa.servlet,{params:{_viewClass:"pgadmin:SetAssetPermissionService",shouldHavePermission:$(checkBoxElement).is(":checked"),assetId:assetID,permission:assetPermission,group:permissionGroup}}).then(function(response){}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},toggleButtonSelect:function(showElementId,hideElementId){$("#"+hideElementId).hide(),$("#"+showElementId).show().focus()}},_default=pgadmin;exports.default=_default},function(module,exports,__webpack_require__){"use strict";var _interopRequireDefault=__webpack_require__(2);exports.__esModule=!0,exports.default=void 0;var _defineProperty2=_interopRequireDefault(__webpack_require__(12)),_utils=__webpack_require__(1),pwadmin={addPassword:function(userName,url,password){if(0<userName.length&&0<url.length&&0<password.length&&"****"!=password){var params={};params[userName+"@"+url]=password;var params2=new URLSearchParams(params);_utils.axiosInstance.post("credentialHandler",params2).then(function(){window.location="swp?_viewClass=pwadmin:PasswordManagerPage"}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})}},submitPassword:function(user,url){var pw=$("#password-field").val();if(""!=pw)return _utils.axiosInstance.post("credentialHandler",(0,_defineProperty2.default)({},user+"@"+url,pw)).then(function(){Promise.resolve(swa.populateModalDialog("Password saved.")).then(function(){window.location="swp?_viewClass=pwadmin:PasswordManagerPage"})}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},removePassword:function(userAtUrl){var removeConfirmed=swa.populateConfirmDialog("Remove secure storage password for "+userAtUrl+"?");Promise.resolve(removeConfirmed).then(function(){var params2=new URLSearchParams({_viewClass:"pwadmin:RemoveSecureStoragePasswordService",user:userAtUrl});return _utils.axiosInstance.post(swa.server+swa.servlet,params2).then(function(){window.location="swp?_viewClass=pwadmin:PasswordManagerPage"}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},initAddPasswordDialog:function(){var userName=$("#userName"),url=$("#url"),password=$("#password");$("#addPasswordDialog").dialog({autoOpen:!1,modal:!0,buttons:{"Add Password":function(){pwadmin.addPassword(userName.val(),url.val(),password.val()),$(this).dialog("close")},Cancel:function(){$(this).dialog("close")}},open:function(){var thisDialog=this;$(thisDialog).keypress(function(key){key.keyCode==$.ui.keyCode.ENTER&&(pwadmin.addPassword(userName.val(),url.val(),password.val()),$(thisDialog).dialog("close"))})},close:function(){userName.val(""),url.val(""),password.val("")}})},openAddPasswordDialog:function(){$("#addPasswordDialog").dialog("open")}},_default=pwadmin;exports.default=_default},function(module,exports){module.exports=function(obj,key,value){return key in obj?Object.defineProperty(obj,key,{value:value,enumerable:!0,configurable:!0,writable:!0}):obj[key]=value,obj}},function(module,exports,__webpack_require__){"use strict";exports.__esModule=!0,exports.default=void 0;var servicedoc={reload:function(){var graphURIs="";$(".service-documentation-page .graphCheckBox").each(function(index,value){$(value).is(":checked")&&(0<graphURIs.length&&(graphURIs+=" "),graphURIs+=$(value).attr("value"))}),swa.load("main",{graphURIs:'"'+graphURIs+'"'})}};$(function(){var allSelected=!1;$(".service-documentation-page .service-filter .select-all").click(function(){allSelected=!allSelected,$(".service-documentation-page .service-filter .graphCheckBox").prop("checked",allSelected),$(".service-documentation-page .service-filter .select-all").text(allSelected?"Deselect all":"Select all"),servicedoc.reload()})});var _default=servicedoc;exports.default=_default},function(module,exports,__webpack_require__){"use strict";exports.__esModule=!0,exports.default=void 0;var _utils=__webpack_require__(1),tbladmin={hideUserAndPassword:function(){$("#evnViewerServerUserName").hide(),$("#evnViewerServerPassword").hide()},resetCachedGraph:function(graphURI,buttonId){return $("#"+buttonId).attr("disabled","disabled"),_utils.axiosInstance.get("swp",{params:{_snippet:!0,_viewClass:"tbladmin:ResetCachedGraphService",graph:"<"+graphURI+">"}}).then(function(response){response.data?swa.populateModalDialog("Cache succesfully cleared.",null,null):swa.populateModalDialog("Unexpected result: "+response.data,null,null)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},rdbmsVacuum:function(){var confirmed=swa.populateConfirmDialog("Are you sure?  This will irrevocably delete data from the database!  Only do this during a maintenance window with no user access!");Promise.resolve(confirmed).then(function(){return _utils.axiosInstance.get("swp",{params:{_snippet:!0,_viewClass:"tbladmin:RDBMSVacuumService"}}).then(function(response){response.data||0==response.data?swa.populateModalDialog("Deleted "+response.data+" orphaned nodes.",null,null):swa.populateModalDialog("Unexpected result: "+response.data,null,null)}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})},function(err){})},sendProjects:function(progressId){var params=$("#form").serialize(),params2=new URLSearchParams(params);return swa.openProgressMonitorDialog(progressId,"Sending Projects...","Sending Projects to Other TBL Server..."),_utils.axiosInstance.post(swa.server+"sendProjects",params2).then(function(){swa.closeProgressMonitorDialog(),swa.populateModalDialog(response.data.projects+" projects with "+response.data.files+" selected files have been sent successfully.","Success",null)}).catch(function(err){swa.closeProgressMonitorDialog()})},toggleUserAndPassword:function(){var anonymous=$("#evnViewerServerIsAnonymous").val(),userName=$("#evnViewerServerUserName").find(".test-evnViewerServerUserName")[0];"true"==anonymous?($(userName).prop("disabled",!0),$("#evnViewerServerPassword").hide()):($(userName).prop("disabled",!1),$("#evnViewerServerPassword").show())},updateFileCheckBoxes:function(classId,checked){$(".checkboxclass-"+classId).prop("checked",checked)},useLegacyExplorer:function(){return!1},showClearTarget:function(allowChecked){$("#clearTarget").toggle(allowChecked)},checkKey:function(e,elem,name,username,url){13==e.keyCode&&($("#"+elem.id).blur(),tbladmin.submitPassword(elem,name,username,url),e.preventDefault())},submitPassword:function(elem,name,username,url){var id=elem.id,pw=$("#"+id).val();if(""!=pw&&"****"!=pw){var data={};data[name=username+"@"+url]=pw;var params2=new URLSearchParams(data);return _utils.axiosInstance.post("credentialHandler",params2).then(function(){swa.populateModalDialog(name+" saved.")}).catch(function(err){swa.populateModalDialog("Operation failed: "+err,"Operation failed",null)})}}};$(document).on("blur keypress","input[class$='smtpServerFrom']",function(e){var input=$(this).val();0!=input.length||13==e.which&&0!=input.length?/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(input)?($("#smtpFromError").remove(),$(".save-button").prop("disabled",!1)):(0==$("#smtpFromError").length&&$(this).after('<p id="smtpFromError" class="text-danger">Please enter a valid email address</p>'),$(".save-button").prop("disabled",!0)):($("#smtpFromError").remove(),$(".save-button").prop("disabled",!1))});var _default=tbladmin;exports.default=_default},function(module,exports,__webpack_require__){"use strict";$(function(){$(".tblui-section").on("click","button.dismiss-message",function(){$(this).closest(".tblui-section").hide()}),$(".tblui-section").on("click",".toggle-message-details",function(){var $section=$(this).closest(".tblui-section");$section.find(".toggle-message-details").toggleClass("hidden"),$section.find(".message-details").toggleClass("hidden")}),$("form#new-username").submit(function(){return cookies.setCookie("username",$("#input-username").val()),location.reload(),!1}),$("#basic-auth-logout").click(function(){alert("Automatic logout is not supported in this configuration. To log out, you will need to quit and restart your browser.")})})}]));
//# sourceMappingURL=server.bundle.js.map