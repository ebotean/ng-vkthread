/**
 * worker.js - component of vkThread plugin.
 *
 * Copyright (c) 2013 - 2016 Vadim Kiryukhin ( vkiryukhin @ gmail.com )
 * https://github.com/vkiryukhin/vkthread
 * http://www.eslinstructor.net/vkthread/
 *
 */

/* jshint -W074, -W117, -W061*/
/* global Promise, self, postMessage, importScripts, onmessage:true */
/* use packer http://dean.edwards.name/packer/ */
/* http://stackoverflow.com/questions/16713925/angularjs-and-web-workers */
(function() {
    "use strict";

    var JSONfn = {
        parse: function(str, date2obj) {
            var iso8061 = date2obj ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/ : false;

            return JSON.parse(str, function(key, value) {
                var prefix,
                    func, fnArgs, fnBody;

                if (typeof value !== "string") {
                    return value;
                }
                if (value.length < 8) {
                    return value;
                }

                prefix = value.substring(0, 8);

                if (iso8061 && value.match(iso8061)) {
                    return new Date(value);
                }
                if (prefix === "function") {
                    return eval("(" + value + ")");
                }
                if (prefix === "_PxEgEr_") {
                    return eval(value.slice(8));
                }
                if (prefix === "_NuFrRa_") {
                    func = value.slice(8).trim().split("=>");
                    fnArgs = func[0].trim();
                    fnBody = func[1].trim();
                    if (fnArgs.indexOf("(") < 0) {
                        fnArgs = "(" + fnArgs + ")";
                    }
                    if (fnBody.indexOf("{") < 0) {
                        fnBody = "{ return " + fnBody + "}";
                    }
                    return eval("(" + "function" + fnArgs + fnBody + ")");
                }

                return value;
            });
        }
    };

    onmessage = function(e) {
        var obj = JSONfn.parse(e.data, true),
            cntx = obj.context || self;

        if (obj.importFiles) {
            importScripts.apply(null, obj.importFiles);
        }

        if (typeof obj.fn === "function") { //regular function
            if (typeof Promise !== "undefined") {
                Promise.resolve(obj.fn.apply(cntx, obj.args))
                    .then(function(data) {
                        postMessage(data);
                    })
                    .catch(function(reason) {
                        postMessage(reason);
                    });
            } else {
                // to satisfy IE
                postMessage(obj.fn.apply(cntx, obj.args));
            }

        } else { //ES6 arrow function
            postMessage(self[obj.fn].apply(cntx, obj.args));
        }
    };

    /*
     * XMLHttpRequest in plain javascript;
     */
    function Response(data, status, message, headers) {
        this.data = data;
        this.status = status;
        this.message = message;
        this.headers = headers;
    }

    function vkhttp(cfg) {

        var body = cfg.body ? JSON.stringify(cfg.body) : null,
            contentType = cfg.contentType || "application/json",
            method = cfg.method ? cfg.method.toUpperCase() : "GET",
            headers = cfg.headers && !Array.isArray(cfg.headers) ? cfg.headers : {},
            timeout = cfg.timeout ? cfg.timeout : 60000, //default timeout in miliseconds (60 seconds)
            xhr = new XMLHttpRequest(),
            ret;

        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                ret = new Response(xhr.responseText, xhr.status, xhr.statusText, xhr.getAllResponseHeaders());
            } else {
                // ret = "Error: " + xhr.status + xhr.statusText;
                ret = new Response("ERROR", xhr.status, xhr.statusText, xhr.getAllResponseHeaders());
                // console.log("onload", ret);
            }
        };

        xhr.onerror = function(data) {
            // ret = "Error: " + xhr.status + xhr.statusText;
            ret = new Response("ERROR", xhr.status, xhr.statusText, xhr.getAllResponseHeaders());
            // console.log("onerror", ret);
        };

        xhr.ontimeout = function(e) {
            ret = new Response("ERROR", xhr.status, xhr.statusText);
        };
        // xhr.onabort = function() {
        //   console.log("onabort");
        //   ret = "Error: timeout";
        // }

        xhr.open(method, cfg.url, false); //synchronous request

        xhr.timeout = timeout;

        if (method === "POST" || method === "PUT" || method === "PATCH") {
            xhr.setRequestHeader("Content-Type", contentType);
        }

        //set additional headers
        var keys = Object.keys(headers);
        if (keys.length > 0) {
            keys.forEach(function(key) {
                xhr.setRequestHeader(key, headers[key]);
            });
        };

        //set timeout
        // var timer = setTimeout(function() { /* vs. a.timeout */
        //     console.log("aborting...");
        //     console.log(xhr.readyState);
        //     if (xhr.readyState < 4) {
        //         xhr.abort();
        //         console.log("aborted");
        //     }
        // }, timeout);


        //try to handle server unavailable and differentiate with other ajax error,
        //unsuccessful for now
        try {
            xhr.send(body);
        } catch (e) {
            ret = new Response("ERROR", xhr.status, xhr.statusText, xhr.getAllResponseHeaders());
            // console.log("catch ", ret);
        }


        // clearTimeout(timer);

        return ret;
    };

}());