// ==UserScript==
// @name         gm4-polyfill-mach6-legacy
// @description  This utility is designed to ease authoring user scripts compatible with both Greasemonkey 4 and other/older user script engines.
// @version      2.0
// @namespace    https://github.com/machsix/gm4-polyfill
// @author       mach6
// @license      GPL
// ==/UserScript==

/*
This helper script bridges compatibility between the Greasemonkey 4 APIs and
existing/legacy APIs.  Say for example your user script includes

    // @grant GM_getValue

And you'd like to be compatible with both Greasemonkey 3 and Greasemonkey 4
(and for that matter all versions of Violentmonkey, Tampermonkey, and any other
user script engine).  Add:

    // @grant GM.getValue
    // @require https://greasemonkey.github.io/gm4-gcgm4-polyfill.js

And switch to the new (GM-dot) APIs, which return promises.  If your script
is running in an engine that does not provide the new asynchronous APIs, this
helper will add them, based on the old APIs.

If you use `await` at the top level, you'll need to wrap your script in an
`async` function to be compatible with any user script engine besides
Greasemonkey 4.

    (async () => {
    let x = await GM.getValue('x');
    })();
*/

if (typeof GM == "undefined") {
  this.GM = {};
}

if (typeof GM_addStyle == "undefined") {
  this.GM_addStyle = function(aCss) {
    var head = document.getElementsByTagName("head")[0];
    if (head) {
      const style = document.createElement("style");
      style.setAttribute("type", "text/css");
      style.textContent = aCss;
      head.appendChild(style);
      return style;
    }
    return null;
  };
}

if (typeof GM_registerMenuCommand == "undefined") {
  this.GM_registerMenuCommand = function(caption, commandFunc, accessKey) {
    if (!document.body) {
      if (document.readyState === "loading" && document.documentElement && document.documentElement.localName === "html") {
        new MutationObserver(function(mutations, observer) {
          if (document.body) {
            observer.disconnect();
            GM_registerMenuCommand(caption, commandFunc, accessKey);
          }
        }).observe(document.documentElement, {childList: true});
      } else {
        console.error("GM_registerMenuCommand got no body.");
      }
      return;
    }
    var contextMenu = document.body.getAttribute("contextmenu");
    var menu = contextMenu ? document.querySelector("menu#" + contextMenu) : null;
    if (!menu) {
      menu = document.createElement("menu");
      menu.setAttribute("id", "gm-registered-menu");
      menu.setAttribute("type", "context");
      document.body.appendChild(menu);
      document.body.setAttribute("contextmenu", "gm-registered-menu");
    }
    var menuItem = document.createElement("menuitem");
    menuItem.textContent = caption;
    menuItem.addEventListener("click", commandFunc, true);
    menu.appendChild(menuItem);
  };
}

if (typeof GM_getResourceText == "undefined") {
  this.GM_getResourceText = function(aRes) {
    return GM.getResourceUrl(aRes)
      .then(function(url) {
        return fetch(url);
      })
      .then(function(resp) {
        return resp.text();
      })
      .catch(function(error) {
        GM.log("Request failed", error);
        return null;
      });
  };
}

// polyfill for GM3
if (typeof GM_notification === "undefined" || GM_notification === null) {
  this.GM_notification = function(options) {
    const opts = {};
    if (typeof options === "string") {
      opts.text = options;
      opts.title = arguments[1];
      opts.image = arguments[2];
      opts.onclick = arguments[3];
    } else {
      Object.keys(options).forEach(function(key) {
        opts[key] = options[key];
      });
    }

    checkPermission();

    function checkPermission() {
      if (Notification.permission === "granted") {
        fireNotice(opts);
      } else if (Notification.permission === "denied") {
        alert("User has denied notifications for this page/site!");
        // eslint-disable-next-line no-useless-return
        return;
      } else {
        Notification.requestPermission(function(permission) {
          console.log("New permission: ", permission);
          checkPermission();
        });
      }
    }

    function fireNotice(ntcOptions) {
      if (ntcOptions.text && !ntcOptions.body) {
        ntcOptions.body = ntcOptions.text;
      }
      var ntfctn = new Notification(ntcOptions.title, ntcOptions);

      if (ntcOptions.onclick) {
        ntfctn.onclick = ntcOptions.onclick;
      }
      if (ntcOptions.timeout) {
        setTimeout(function() {
          ntfctn.close();
        }, ntcOptions.timeout);
      }
    }
  };
}

if (!Object.entries) {
  Object.entries = function(obj) {
    var ownProps = Object.keys(obj),
      i = ownProps.length,
      resArray = new Array(i); // preallocate the Array
    while (i--) {
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    }
    return resArray;
  };
}

Object.entries({
  log: console.log.bind(console),
}).forEach(function(values) {
  var newKey = values[0];
  var old = values[1];
  if (typeof GM[newKey] === "undefined") {
    GM[newKey] = old;
  }
});

Object.entries({
  GM_addStyle: "addStyle",
  GM_deleteValue: "deleteValue",
  GM_getResourceURL: "getResourceUrl",
  GM_getValue: "getValue",
  GM_listValues: "listValues",
  GM_notification: "notification",
  GM_openInTab: "openInTab",
  GM_registerMenuCommand: "registerMenuCommand",
  GM_setClipboard: "setClipboard",
  GM_setValue: "setValue",
  GM_xmlhttpRequest: "xmlHttpRequest",
  GM_getResourceText: "getResourceText"
}).forEach(
  function(values) {
    var oldKey = values[0];
    var newKey = values[1];
    var old = this[oldKey];
    if (old && typeof GM[newKey] == "undefined") {
      if (oldKey === "GM_addStyle") {
        GM[newKey] = function() {
          return old.apply(this, arguments);
        };
      } else {
        GM[newKey] = function() {
          const args = arguments;
          return new Promise(
            function(resolve, reject) {
              try {
                resolve(old.apply(this, args));
              } catch (e) {
                reject(e);
              }
            }.bind(this)
          );
        };
      }
    }
  }.bind(this)
);

// Adguard or other script manager which don't inject functions to window
if (typeof GM.getValue === "undefined" && typeof GM_getValue === "function") {
  GM.getValue = GM_getValue;
}
if (typeof GM.setValue === "undefined" && typeof GM_setValue === "function") {
  GM.setValue = GM_setValue;
}
if (typeof GM.xmlHttpRequest === "undefined" && typeof GM_xmlhttpRequest === "function") {
  GM.xmlHttpRequest = GM_xmlhttpRequest;
}
if (typeof GM.registerMenuCommand === "undefined" && typeof GM_registerMenuCommand === "function") {
  GM.registerMenuCommand = GM_registerMenuCommand;
}
if (typeof GM.info === "undefined" && typeof GM_info === "object") {
  GM.info = GM_info;
}

// https://stackoverflow.com/questions/36779883/userscript-notifications-work-on-chrome-but-not-firefox
// if (typeof GM.notification == "undefined") {
//   GM.notification = function(ntcOptions) {
//     checkPermission();

//     function checkPermission() {
//       if (Notification.permission === "granted") {
//         fireNotice();
//       } else if (Notification.permission === "denied") {
//         alert("User has denied notifications for this page/site!");
//         // eslint-disable-next-line no-useless-return
//         return;
//       } else {
//         Notification.requestPermission(function(permission) {
//           console.log("New permission: ", permission);
//           checkPermission();
//         });
//       }
//     }

//     function fireNotice() {
//       // only accept object input
//       if (!ntcOptions.title) {
//         console.log("Title is required for notification");
//         return;
//       }
//       if (ntcOptions.text && !ntcOptions.body) {
//         ntcOptions.body = ntcOptions.text;
//       }
//       var ntfctn = new Notification(ntcOptions.title, ntcOptions);

//       if (ntcOptions.onclick) {
//         ntfctn.onclick = ntcOptions.onclick;
//       }
//       if (ntcOptions.timeout) {
//         setTimeout(function() {
//           ntfctn.close();
//         }, ntcOptions.timeout);
//       }
//     }
//   };
// }
