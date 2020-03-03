(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.NeighborGram = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   3.3.1
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  return typeof x === 'function' || typeof x === 'object' && x !== null;
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (!Array.isArray) {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
} else {
  _isArray = Array.isArray;
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  return function () {
    vertxNext(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  _resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then, value, fulfillmentHandler, rejectionHandler) {
  try {
    then.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        _resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      _reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      _reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    _reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return _resolve(promise, value);
    }, function (reason) {
      return _reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$) {
  if (maybeThenable.constructor === promise.constructor && then$$ === then && maybeThenable.constructor.resolve === resolve) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$ === GET_THEN_ERROR) {
      _reject(promise, GET_THEN_ERROR.error);
    } else if (then$$ === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$)) {
      handleForeignThenable(promise, maybeThenable, then$$);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function _resolve(promise, value) {
  if (promise === value) {
    _reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function _reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      _reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      _resolve(promise, value);
    } else if (failed) {
      _reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      _reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      _resolve(promise, value);
    }, function rejectPromise(reason) {
      _reject(promise, reason);
    });
  } catch (e) {
    _reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this._input = input;
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate();
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    _reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
};

Enumerator.prototype._enumerate = function () {
  var length = this.length;
  var _input = this._input;

  for (var i = 0; this._state === PENDING && i < length; i++) {
    this._eachEntry(_input[i], i);
  }
};

Enumerator.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$ = c.resolve;

  if (resolve$$ === resolve) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$) {
        return resolve$$(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$(entry), i);
  }
};

Enumerator.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      _reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  _reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise ? initializePromise(this, resolver) : needsNew();
  }
}

Promise.all = all;
Promise.race = race;
Promise.resolve = resolve;
Promise.reject = reject;
Promise._setScheduler = setScheduler;
Promise._setAsap = setAsap;
Promise._asap = asap;

Promise.prototype = {
  constructor: Promise,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

function polyfill() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise;
}

polyfill();
// Strange compat..
Promise.polyfill = polyfill;
Promise.Promise = Promise;

return Promise;

})));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":3}],2:[function(require,module,exports){
/*! FileSaver.js v1.3.6
 *
 * A saveAs() FileSaver implementation.
 *
 * By Travis Clarke, https://travismclarke.com
 * By Eli Grey, http://eligrey.com
 *
 * License: MIT (https://github.com/clarketm/FileSaver.js/blob/master/LICENSE.md)
 */

;(function (root, factory) {
    if (typeof exports === 'object' && typeof exports.nodeName !== 'string') {
        module.exports = root.document ? factory(root, true) : function (w) {
            if (!w.document) {
                throw new Error("FileSaver requires a window with a document");
            }
            return factory(w);
        };
    } else {
        factory(root);
    }
}(window || this, function (window, noGlobal) {
        "use strict";
        // IE <10 is explicitly unsupported
        if (typeof window === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
            return;
        }
        var
            doc = window.document
            // only get URL when necessary in case Blob.js hasn't overridden it yet
            , get_URL = function () {
                return window.URL || window.webkitURL || window;
            }
            , save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
            , can_use_save_link = "download" in save_link
            , click = function (node) {
                var event = new MouseEvent("click");
                node.dispatchEvent(event);
            }
            , is_safari = /constructor/i.test(window.HTMLElement) || window.safari
            , is_chrome_ios = /CriOS\/[\d]+/.test(navigator.userAgent)
            , throw_outside = function (ex) {
                (window.setImmediate || window.setTimeout)(function () {
                    throw ex;
                }, 0);
            }
            , force_saveable_type = "application/octet-stream"
            // the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
            , arbitrary_revoke_timeout = 1000 * 40 // in ms
            , revoke = function (file) {
                var revoker = function () {
                    if (typeof file === "string") { // file is an object URL
                        get_URL().revokeObjectURL(file);
                    } else { // file is a File
                        file.remove();
                    }
                };
                setTimeout(revoker, arbitrary_revoke_timeout);
            }
            , dispatch = function (filesaver, event_types, event) {
                event_types = [].concat(event_types);
                var i = event_types.length;
                while (i--) {
                    var listener = filesaver["on" + event_types[i]];
                    if (typeof listener === "function") {
                        try {
                            listener.call(filesaver, event || filesaver);
                        } catch (ex) {
                            throw_outside(ex);
                        }
                    }
                }
            }
            , auto_bom = function (blob) {
                // prepend BOM for UTF-8 XML and text/* types (including HTML)
                // note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
                if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
                    return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
                }
                return blob;
            }
            , FileSaver = function (blob, name, no_auto_bom) {
                if (!no_auto_bom) {
                    blob = auto_bom(blob);
                }
                // First try a.download, then web filesystem, then object URLs
                var
                    filesaver = this
                    , type = blob.type
                    , force = type === force_saveable_type
                    , object_url
                    , dispatch_all = function () {
                        dispatch(filesaver, "writestart progress write writeend".split(" "));
                    }
                    // on any filesys errors revert to saving with object URLs
                    , fs_error = function () {
                        if ((is_chrome_ios || (force && is_safari)) && window.FileReader) {
                            // Safari doesn't allow downloading of blob urls
                            var reader = new FileReader();
                            reader.onloadend = function () {
                                var url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
                                var popup = window.open(url, '_blank');
                                if (!popup) window.location.href = url;
                                url = undefined; // release reference before dispatching
                                filesaver.readyState = filesaver.DONE;
                                dispatch_all();
                            };
                            reader.readAsDataURL(blob);
                            filesaver.readyState = filesaver.INIT;
                            return;
                        }
                        // don't create more object URLs than needed
                        if (!object_url) {
                            object_url = get_URL().createObjectURL(blob);
                        }
                        if (force) {
                            window.location.href = object_url;
                        } else {
                            var opened = window.open(object_url, "_blank");
                            if (!opened) {
                                // Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
                                window.location.href = object_url;
                            }
                        }
                        filesaver.readyState = filesaver.DONE;
                        dispatch_all();
                        revoke(object_url);
                    }
                    ;
                filesaver.readyState = filesaver.INIT;

                if (can_use_save_link) {
                    object_url = get_URL().createObjectURL(blob);
                    setTimeout(function () {
                        save_link.href = object_url;
                        save_link.download = name;
                        click(save_link);
                        dispatch_all();
                        revoke(object_url);
                        filesaver.readyState = filesaver.DONE;
                    });
                    return;
                }

                fs_error();
            }
            , FS_proto = FileSaver.prototype
            , saveAs = function (blob, name, no_auto_bom) {
                return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
            }
            ;
        // IE 10+ (native saveAs)
        if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
            saveAs = function (blob, name, no_auto_bom) {
                name = name || blob.name || "download";

                if (!no_auto_bom) {
                    blob = auto_bom(blob);
                }
                return navigator.msSaveOrOpenBlob(blob, name);
            };
        }

        FS_proto.abort = function () {
        };
        FS_proto.readyState = FS_proto.INIT = 0;
        FS_proto.WRITING = 1;
        FS_proto.DONE = 2;

        FS_proto.error =
            FS_proto.onwritestart =
                FS_proto.onprogress =
                    FS_proto.onwrite =
                        FS_proto.onabort =
                            FS_proto.onerror =
                                FS_proto.onwriteend =
                                    null;

        if (typeof define === "function" && define.amd) {
            define("file-saverjs", [], function () {
                return saveAs;
            });
        }

        if (typeof noGlobal === 'undefined') {
            window.saveAs = saveAs;
        }
        return saveAs;
    }
));

},{}],3:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],4:[function(require,module,exports){
(function (global){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var t;t="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,t.TQGramUI=e()}}(function(){return function(){function e(t,n,o){function i(l,a){if(!n[l]){if(!t[l]){var s="function"==typeof require&&require;if(!a&&s)return s(l,!0);if(r)return r(l,!0);var u=new Error("Cannot find module '"+l+"'");throw u.code="MODULE_NOT_FOUND",u}var d=n[l]={exports:{}};t[l][0].call(d.exports,function(e){var n=t[l][1][e];return i(n?n:e)},d,d.exports,e,t,n,o)}return n[l].exports}for(var r="function"==typeof require&&require,l=0;l<o.length;l++)i(o[l]);return i}return e}()({1:[function(e,t,n){"use strict";function o(e){function t(){r.rootHtml.innerHTML="",r.rootHtml.style.borderTop=0!==r.buttons.length?"1px solid #cccccc":null,r.rootHtml.style.borderBottom=0!==r.buttons.length?"1px solid #cccccc":null,r.buttons.forEach(function(e){var t=document.createElement("BUTTON");t.title=e.label,t.className="tq-ui-toolbar__button tq-ui-colored-button",t.innerHTML='<span style="color: '+e.borderColor+'">'+n(e.label)+"</span>",t.style.backgroundColor=e.backgroundColor||"white",t.style.borderColor=e.borderColor||"black",t.onclick=function(t){e.callback(e,t)},r.rootHtml.appendChild(t)})}function n(e){if(e){var t=e.match(/[a-z'\-]+/gi);return t.filter(function(e){return"and"!==e.toLowerCase()&&"&"!==e}).map(function(e){return e[0]}).join("")}}function o(){var e=document.createElement("DIV");return e.className="tq-ui-colored-buttons-list",e.innerHTML="",e}var r=this;e||(e={}),r.rootHtml=o(),r.id=e.id||"coloredButtons-"+i++,r.rootHtml.id=r.id,r.buttons=e.buttons||[],t(),r.removeAll=function(){r.buttons=[],t()},r.addButton=function(e){r.buttons.map(function(e){return e.id}).indexOf(e.id)===-1&&(r.buttons.push(e),t())},r.removeButton=function(e){r.buttons.splice(r.buttons.indexOf(e),1),t()}}Object.defineProperty(n,"__esModule",{value:!0}),n.ColoredButtonsList=o;var i=0;n["default"]=o},{}],2:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}function i(e){function t(){if(e.body instanceof Object){var t=i.rootHtml.querySelector(".tq-ui-body_container");t.appendChild(e.body.rootHtml)}var a=i.rootHtml.querySelector(".tq-ui-flying-panel_header");a.addEventListener("mousedown",o);var s=i.rootHtml.querySelector(".tq-ui-windows-collapse-button");if(s.onclick=i.hide,e.resizable){var u=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-top-border");u.addEventListener("mousedown",function(e){o(e,"n")});var d=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-right-border");d.addEventListener("mousedown",function(e){o(e,"e")});var c=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-bottom-border");c.addEventListener("mousedown",function(e){o(e,"s")});var f=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-left-border");f.addEventListener("mousedown",function(e){o(e,"w")});var p=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-top-right-border");p.addEventListener("mousedown",function(e){o(e,"ne")});var b=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-top-left-border");b.addEventListener("mousedown",function(e){o(e,"nw")});var m=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-bottom-right-border");m.addEventListener("mousedown",function(e){o(e,"se")});var y=i.rootHtml.querySelector(".tq-ui-flying-panel__border.tq-ui-bottom-left-border");y.addEventListener("mousedown",function(e){o(e,"sw")})}i._triggerButton=r(e.triggerButton),n(),i._triggerButton&&(i._triggerButton.onclick=function(){l?i.show():i.hide()})}function n(){l?(i._triggerButton&&(i._triggerButton.className=i._triggerButton.className.replace(/ tq-ui-selected/gi,"")),i.rootHtml.className=i.rootHtml.className+" tq-ui-collapsed"):(i._triggerButton&&(i._triggerButton.className=i._triggerButton.className+" tq-ui-selected"),i.rootHtml.className=i.rootHtml.className.replace(/ tq-ui-collapsed/gi,""))}function o(e,t){function n(e){i._mouseMove=!0;var n=0;e.pageX?n=e.pageX:e.clientX&&(n=e.clientX);var o=n-l;l=n,t||(i.rootHtml.style.left=i.rootHtml.offsetLeft+o+"px");var s=0;e.pageY?s=e.pageY:e.clientY&&(s=e.clientY);var u=s-a;a=s,t||(i.rootHtml.style.top=i.rootHtml.offsetTop+u+"px"),t?(r(o,u,t),i.trigger("size-changed",{width:i.rootHtml.offsetWidth,height:i.rootHtml.offsetHeight}),t.indexOf("n")===-1&&t.indexOf("w")===-1||i.trigger("position-changed",{x:i.rootHtml.offsetLeft,y:i.rootHtml.offsetTop})):i.trigger("position-changed",{x:i.rootHtml.offsetLeft,y:i.rootHtml.offsetTop})}function o(e){i._mouseMove&&(n(e,!0),i._mouseMove=!1),document.body.onmousemove=document.body.onmouseup=null,document.body.removeEventListener("mousemove",n),document.body.removeEventListener("mouseup",o)}function r(e,t,n){switch(n){case"n":i.rootHtml.style.height=i.rootHtml.offsetHeight-t+"px",i.rootHtml.style.top=i.rootHtml.offsetTop+t+"px";break;case"e":i.rootHtml.style.width=i.rootHtml.offsetWidth+e+"px";break;case"s":i.rootHtml.style.height=i.rootHtml.offsetHeight+t+"px";break;case"w":i.rootHtml.style.width=i.rootHtml.offsetWidth-e+"px",i.rootHtml.style.left=i.rootHtml.offsetLeft+e+"px";break;case"ne":i.rootHtml.style.width=i.rootHtml.offsetWidth+e+"px",i.rootHtml.style.height=i.rootHtml.offsetHeight-t+"px",i.rootHtml.style.top=i.rootHtml.offsetTop+t+"px";break;case"nw":i.rootHtml.style.height=i.rootHtml.offsetHeight-t+"px",i.rootHtml.style.top=i.rootHtml.offsetTop+t+"px",i.rootHtml.style.width=i.rootHtml.offsetWidth-e+"px",i.rootHtml.style.left=i.rootHtml.offsetLeft+e+"px";break;case"se":i.rootHtml.style.width=i.rootHtml.offsetWidth+e+"px",i.rootHtml.style.height=i.rootHtml.offsetHeight+t+"px";break;case"sw":i.rootHtml.style.height=i.rootHtml.offsetHeight+t+"px",i.rootHtml.style.width=i.rootHtml.offsetWidth-e+"px",i.rootHtml.style.left=i.rootHtml.offsetLeft+e+"px"}}var l=0,a=0;e.pageX?l=e.pageX:e.clientX&&(l=e.clientX),e.pageY?a=e.pageY:e.clientY&&(a=e.clientY),window.getSelection().removeAllRanges(),document.body.addEventListener("mousemove",n),document.body.addEventListener("mouseup",o)}s["default"].apply(this);var i=this;e||(e={});var l=!e.active;i.markup='\n        <div class="tq-ui-flying-panel"\n            style="\n                width: '+(e.size?e.size.width:"")+";\n                height: "+(e.size?e.size.height:"")+";\n                left: "+(e.position?e.position.x:"")+";\n                top: "+(e.position?e.position.y:"")+';\n            "\n        >\n            <div class="tq-ui-flying-panel_header">\n                <div class="tq-ui-flying-panel_header__header">\n                    <label class="tq-ui-window-header-label">'+(e.header?e.header:"")+'</label>\n                    <img class="tq-ui-windows-collapse-button"/>\n                </div>\n            </div>\n            <div class="tq-ui-body">\n                <div class="tq-ui-body_container '+(e.removeBackground?"tq-ui-body_empty-container":"tq-ui-body_default-container")+'">\n                    '+(e.body&&"string"==typeof e.body?e.body:"")+"\n                </div>\n            </div>\n            "+(e.resizable?'\n                <div class="tq-ui-flying-panel__border tq-ui-top-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-right-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-bottom-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-left-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-top-left-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-top-right-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-bottom-left-border"></div>\n                <div class="tq-ui-flying-panel__border tq-ui-bottom-right-border"></div>\n            ':"")+"\n        </div>";var a=r(e.baseElement);a.innerHTML=i.markup,i.rootHtml=a.querySelector(".tq-ui-flying-panel"),i.id=e.id||"flyingPanel-"+u++,i.rootHtml.id=i.id,i.show=function(e){e&&e.stopPropagation(),l&&(l=!1,n())},i.hide=function(e){e&&e.stopPropagation(),l||(l=!0,n())},t()}function r(e){var t=void 0;return"string"==typeof e?t=document.getElementById(e):"object"===("undefined"==typeof e?"undefined":l(e))&&(t=e),t}Object.defineProperty(n,"__esModule",{value:!0});var l="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};n.FlyingPanel=i;var a=e("./subscriptionAPI/subscribeable"),s=o(a),u=0;n["default"]=i},{"./subscriptionAPI/subscribeable":8}],3:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}function i(e){function t(e){function t(e){var t=e.label,n=e.label+" ("+e.id+")",o=document.createElement("LI");return o.className="tq-ui-property-button",o.title=n,o.innerText=t,o.onclick=function(){i.trigger("selected-element-changed",e.id)},o}var n=i.rootHtml.querySelector("#relatedElements");n.innerHTML="";var o=e.incomings||[];if(o.length){var r=document.createElement("LABEL");r.className="tq-label",r.innerText="Incoming nodes:",n.appendChild(r);var l=document.createElement("UL");l.className="tq-ui-info-panel_related-elements_list",n.appendChild(l),o.forEach(function(e){l.appendChild(t(e))})}var a=e.outgoings||[];if(a.length){var s=document.createElement("LABEL");s.className="tq-label",s.innerText="Outgoing nodes:",n.appendChild(s);var u=document.createElement("UL");u.className="tq-ui-info-panel_related-elements_list",n.appendChild(u),a.forEach(function(e){u.appendChild(t(e))})}}function n(e){var t="";return Object.keys(e).forEach(function(n){t+='<label for="'+n+'" class="tq-label">'+n+'</label>\n                        <input id="'+n+'" type="text" class="tq-ui-property" value="'+e[n]+'" disabled></input>'}),t}function o(){var e=document.createElement("DIV");return e.className="tq-ui-info-panel",e.innerHTML=i.markup,e}l["default"].apply(this),e||(e={});var i=this,r=e.placeholder||"Select a diagram element",s='<div class="tq-ui-info-panel_empty-stuff">'+r+"</div>";i.rootHtml=o(),i.rootHtml.innerHTML=s,i.id=e.id||"infoPanel-"+a++,i.rootHtml.id=i.id,i.setSelectedElement=function(o){if(o){if(i.rootHtml.innerHTML=""+(e.launchExternal&&"node"===o.diagramType?'<div class="tq-ui-group">\n                      <button id="tqLaunchExternalBtn" class="tq-button" title="View more in new tab.">\n                        More &nbsp;\n                      <span class="glyphicon glyphicon-new-window"></span></button>\n                     </div>':"")+(o.id?'\n                    <label class="tq-label">ID</label>\n                    <input value="'+o.id+'" type="text" class="tq-ui-property" disabled></input>\n                ':"")+(o.label?'\n                    <label class="tq-label">Label</label>\n                    <input value="'+o.label+'" type="text" class="tq-ui-property" disabled></input>\n                ':"")+(o.types?'\n                    <label class="tq-label">Types</label>\n                    <input value="'+o.types+'" type="text" class="tq-ui-property" disabled></input>\n                ':"")+(o.source?'\n                    <label for="linkFrom" class="tq-label">Source</label>\n                    <div id="linkFrom" type="text" class="tq-ui-property-button"></div>\n                ':"")+(o.target?'\n                    <label for="linkTo" class="tq-label">Target</label>\n                    <div id="linkTo" type="text" class="tq-ui-property-button"></div>\n                ':"")+(o.thickness?'\n                    <label for="thickness" class="tq-label">Thickness</label>\n                    <input value="'+o.thickness+'" type="text" class="tq-ui-property" disabled></input>\n                ':"")+(o.data?n(o.data):"")+(o.relations?'\n                    <label for="relatedElements" class="tq-label">Related elements</label>\n                    <div   id="relatedElements" class="tq-ui-info-panel_related-elements"></div>\n                ':""),e.launchExternal&&"node"===o.diagramType){var r=document.getElementById("tqLaunchExternalBtn");r.onclick=function(){e.launchExternal(o)}}if(o.relations&&t(o.relations),o.source){var l=document.getElementById("linkFrom");l.innerText=o.source.label,l.title=o.source.label+"(ID: "+o.source.id+")",l.onclick=function(){i.trigger("selected-element-changed",o.source.id)}}if(o.target){var a=document.getElementById("linkTo");a.innerText=o.target.label,a.title=o.target.label+"(ID: "+o.target.id+")",a.onclick=function(){i.trigger("selected-element-changed",o.target.id)}}}else i.rootHtml.innerHTML=s},e.selectedElement&&i.setSelectedElement(e.selectedElement)}Object.defineProperty(n,"__esModule",{value:!0}),n.InfoPanel=i;var r=e("./subscriptionAPI/subscribeable"),l=o(r),a=0;n["default"]=i},{"./subscriptionAPI/subscribeable":8}],4:[function(e,t,n){"use strict";function o(e){function t(){var e=document.createElement("DIV");return e.innerHTML=n.markup,e.querySelector(".tq-ui-legend-panel_body_legends")}var n=this;e||(e={});var o=e.legends||[];n.markup='\n        <div class="tq-ui-legend-panel_body_legends">\n        '+o.map(function(e){return'\n                <div class="tq-ui-legend-panel_body_legends_legend" title="'+e.description+'">\n                    <div class="tq-ui-legend-panel_body_legends_legend_img"><img src="'+e.image+'"></div>\n                    <label class="tq-label">'+e.label+"</label>\n                </div>\n            "}).join("")+"\n        </div>\n    ",n.rootHtml=t(),n.id=e.id||"legends-"+i++,n.rootHtml.id=n.id}Object.defineProperty(n,"__esModule",{value:!0}),n.Legends=o;var i=0;n["default"]=o},{}],5:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}var i=e("./coloredButtonsList"),r=o(i),l=e("./flyingPanel"),a=o(l),s=e("./infoPanel"),u=o(s),d=e("./legends"),c=o(d),f=e("./progressScreen"),p=o(f),b=e("./searchPanel"),m=o(b),y=e("./switcher"),v=o(y),g=e("./tabPanel"),h=o(g),H=e("./toolbar"),q=o(H);t.exports={ColoredButtonsList:r["default"],FlyingPanel:a["default"],InfoPanel:u["default"],Legends:c["default"],ProgressScreen:p["default"],SearchPanel:m["default"],Switcher:v["default"],TabPanel:h["default"],Toolbar:q["default"]}},{"./coloredButtonsList":1,"./flyingPanel":2,"./infoPanel":3,"./legends":4,"./progressScreen":6,"./searchPanel":7,"./switcher":9,"./tabPanel":10,"./toolbar":11}],6:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}function i(e){function t(){var e=document.createElement("DIV");return e.className="tq-ui-progress-screen",e.innerHTML=o.markup,e}function n(e){var t=void 0;return"string"==typeof e?t=document.getElementById(e):"object"===("undefined"==typeof e?"undefined":r(e))&&(t=e),t}a["default"].apply(this);var o=this;e||(e={}),o.markup="",o.state="completed",o.rootHtml=t(),o.id=e.id||"tabPanel-"+s++,o.rootHtml.id=o.id;var i=n(e.baseElement);i.appendChild(o.rootHtml),o.setState=function(e,t){e&&(o.state=e,"active"===e?(o.rootHtml.innerHTML="<h1>"+(t||u)+'</h1><div class="tq-ui-progress-screen__progress"></div>',o.rootHtml.style.display=null):"completed"===e?(o.rootHtml.innerHTML="",o.rootHtml.style.display="none"):"error"===e&&(o.rootHtml.innerHTML="<h1>"+(t||d)+"</h1>",o.rootHtml.style.display=null),o.trigger("diagram-state-changed",e))},o.setState(e.state,e.text)}Object.defineProperty(n,"__esModule",{value:!0});var r="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};n.ProgressScreen=i;var l=e("./subscriptionAPI/subscribeable"),a=o(l),s=0,u="Loading",d="Error has occurred!";n["default"]=i},{"./subscriptionAPI/subscribeable":8}],7:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}function i(e){l["default"].apply(this),e||(e={});var t=e.searchButtonId||"tqLgSearchButton",n=e.searchId||"search";s["default"].apply(this,[{id:e.id,baseElement:e.baseElement,active:e.active,header:e.header||"Search panel",triggerButton:e.triggerButton,body:"\n            <span id= "+t+' class="tq-ui-search-icon glyphicon glyphicon-search" aria-hidden="true"></span>\n            <input id="'+n+'" placeHolder="Search..." class="tq-ui-search-input"></input>\n        ',removeBackground:!0,size:{width:"260px",height:"70px"}}])}Object.defineProperty(n,"__esModule",{value:!0}),n.SearchPanel=i;var r=e("./subscriptionAPI/subscribeable"),l=o(r),a=e("./flyingPanel"),s=o(a);n["default"]=i},{"./flyingPanel":2,"./subscriptionAPI/subscribeable":8}],8:[function(e,t,n){"use strict";function o(){var e=this;e._subscribtions={},e.on=function(t,n){e._subscribtions[t]||(e._subscribtions[t]=[]),e._subscribtions[t].push(n)},e.unsubscribe=function(t){Object.keys(e._subscribtions).map(function(t){return e._subscribtions[t]}).forEach(function(e){var n=e.indexOf(t);n!==-1&&e.splice(n,1)})},e.trigger=function(t,n){var o=this;n instanceof Array||(n=[n]),e._subscribtions&&e._subscribtions[t]&&e._subscribtions[t].forEach(function(e){e.apply(o,n)})}}Object.defineProperty(n,"__esModule",{value:!0}),n.Subscribable=o,n["default"]=o},{}],9:[function(e,t,n){"use strict";function o(e){return e&&e.__esModule?e:{"default":e}}function i(e){function t(){var t=document.createElement("DIV");return t.className="tq-ui-switch-buttons"+(e.verticalOrientation?"-vertical":""),t.innerHTML=n.markup,t}l["default"].apply(this),e||(e={});var n=this,o=e.states||[];n.markup=o.map(function(t,n){return'<button id="'+t.id+'" '+(0!==n?"":"disabled")+' title="'+(t.label||t.id)+'">\n            '+(e.verticalOrientation&&t.icon?'<span class="'+t.icon+'" aria-hidden="true"></span>':t.label||t.id)+"\n        </button>"}).join(""),n.rootHtml=t(),n.id=e.id||"switcher-"+a++,n.rootHtml.id=n.id;var i=null;o.forEach(function(e,t){var o=n.rootHtml.querySelector("#"+e.id);0===t&&(i=o),o.onclick=function(){o.disabled=!0,i.disabled=!1,i=o,n.trigger("state-changed",e.id)}}),n.setState=function(e){var t=n.rootHtml.querySelector("#"+e);t&&e!==i.id&&(t.disabled=!0,i.disabled=!1,i=t)}}Object.defineProperty(n,"__esModule",{value:!0}),n.Switcher=i;var r=e("./subscriptionAPI/subscribeable"),l=o(r),a=0;n["default"]=i},{"./subscriptionAPI/subscribeable":8}],10:[function(e,t,n){"use strict";function o(e){function t(){var e=document.createElement("DIV");return e.className="tq-ui-tab-panel",e.innerHTML=n.markup,e}var n=this;e||(e={});var o=e.tabs||[];n.markup='\n        <div class="tq-ui-tab-switcher tq-ui-switch-buttons">'+o.map(function(e,t){return'\n            <button id="'+e.id+'" '+(0!==t?"":"disabled")+">\n                "+(e.label||e.id)+"\n            </button>  \n        "}).join("")+"</div>"+o.map(function(e,t){return'\n            <div id="'+e.id+'Panel" class="tq-ui-tab-panel_page" style="display: '+(0===t?"":"none")+'">\n                <div class="tq-ui-tab-panel_page_body">\n                    '+("string"==typeof e.body?e.body:"")+"\n                </div>\n            </div>\n        "}).join(""),n.rootHtml=t(),n.id=e.id||"tabPanel-"+i++,n.rootHtml.id=n.id,o.map(function(e){if(e.body instanceof Object&&e.body.rootHtml){var t=n.rootHtml.querySelector("#"+e.id+"Panel .tq-ui-tab-panel_page_body");t.appendChild(e.body.rootHtml)}});var r=null;o.forEach(function(e,t){var o=n.rootHtml.querySelector("#"+e.id),i=n.rootHtml.querySelector("#"+e.id+"Panel");0===t&&(r={tabBtn:o,tabPanel:i}),o.onclick=function(){o.disabled=!0,i.style.display="",r.tabBtn.disabled=!1,r.tabPanel.style.display="none",r={tabBtn:o,tabPanel:i}}})}Object.defineProperty(n,"__esModule",{value:!0}),n.TabPanel=o;var i=0;n["default"]=o},{}],11:[function(e,t,n){"use strict";function o(e){function t(e){var t=void 0;if("string"==typeof e){var n=document.createElement("DIV");n.innerHTML=e,t=n.firstChild}else if(e.id&&e.icon){var o=document.createElement("DIV");if(o.innerHTML='<button id="'+e.id+'" title="'+(e.label||e.id)+'" class="tq-ui-toolbar__button">\n                <span class="'+e.icon+'" aria-hidden="true"></span>\n            </button>',t=o.firstChild,e.icon2){var i=!0;t.onclick=function(n){t.innerHTML='<span class="'+(i?e.icon2:e.icon)+'" aria-hidden="true"></span>',e.callback(n),i=!i}}else t.onclick=e.callback}else e.rootHtml&&(t=e.rootHtml);return t}function n(){var t=void 0;return"string"==typeof e.baseElement?t=document.getElementById(e.baseElement):"object"===i(e.baseElement)&&(t=e.baseElement),t?(t.innerHTML=o.markup,t):null}var o=this;if(e||(e={}),o.markup='\n        <div id="toolbarRootElement" class="tq-ui-toolbar">\n        </div>\n    ',o.rootHtml=n(),o.id=e.id||"toolbar-"+r++,o.rootHtml.id=o.id,!o.rootHtml)throw new Error("The root element is not specified!");o.container=o.rootHtml.querySelector("#toolbarRootElement"),o.pushTool=function(e){var n=t(e);n&&("string"!=typeof n?l.push(e):l.push({id:"customhtml"+r++,markup:e,rootHtml:n}),o.container.appendChild(n))},o.insertTool=function(e,n){var i=Math.min(Math.max(n,0),l.length-1),r=o.container.querySelector("#"+l[i].id);if(r){var a=t(e);a&&(l.splice(i,0,e),o.container.insertBefore(a,r))}else o.pushTool(e)},o.removeTool=function(e){var t="string"==typeof e?e:e.id;l.splice(l.indexOf(e),1);var n=o.container.querySelector("#"+t);o.container.removeChild(n)};var l=[];e.tools.forEach(function(e){o.pushTool(e)})}Object.defineProperty(n,"__esModule",{value:!0});var i="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};n.Toolbar=o;var r=0;n["default"]=o},{}]},{},[5])(5)});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (typeof input === 'string') {
      this.url = input
    } else {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split('\r\n').forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);

},{}],6:[function(require,module,exports){
'use strict';

var defaultOptions = {
    COLOR_CLASS_COUNT: 10,
    COLOR_CLASS_MAP: {
        'subClassOf': 'color-class-sub-class-of',
        'type': 'color-class-type'
    }
};

/**
 * ColorConfigurator.
 * Generate color templates for graph elements.
 *
 * Constructor parameters:
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      getColorTemplate(): { color:string, colorFill:string, colorFont:string, colorFillFocused:string }
 */
function ColorConfigurator (_options) {
    var COLOR_CLASS_COUNT = (_options && _options.COLOR_CLASS_COUNT != undefined ? _options.COLOR_CLASS_COUNT : defaultOptions.COLOR_CLASS_COUNT);
    var _colorClassMap = (_options && _options.COLOR_CLASS_MAP ? _options.COLOR_CLASS_MAP : defaultOptions.COLOR_CLASS_MAP);

    var self = this;
    var _index = 1;

    function _init () {
        _index = Math.round(1 + Math.random() * (COLOR_CLASS_COUNT - 1));
    }

    /**
     * Returns color template for element.
     * @param {string} id - id of element
     * @returns {Object} Color template
     */
    self.getColorClassForElement = function (id) {
        id = verifyId(id);
        if (!_colorClassMap[id]) _colorClassMap[id] = _getNextClass();
        return _colorClassMap[id];
    };

    function verifyId (id) {
        return id.replace(/[^\w\d]/gi, '-');
    }

    function _getNextClass () {
        var className = 'color-class-' + _index++;
        if (_index > COLOR_CLASS_COUNT) _index = 1;
        return className;
    }

    _init();
}

module.exports = ColorConfigurator;

},{}],7:[function(require,module,exports){
'use strict';

var Promise = require('es6-promise').Promise;
require('whatwg-fetch');

var DEFAULT_SERVER_URL = 'http://view.edg.topbraid.net/edg/tbl/swp';
var DEFAULT_BASE = 'http://rdfex.org/withImports?uri=urn:x-evn-pub:fibo';
var DEFAULT_VIEW_CLASS = 'swa:NeighborGramPropertiesDataService';

/**
 * DataProvider.
 * Provides data for the graph.
 *
 * Constructor parameters:
 *      serverURL: string
 *      base: string
 *      viewClass: string
 *
 * Public methods:
 *      getGraphData(focusNode:string, successCallback: function, errorCallback: function): void
 */
function DataProvider (serverURL, base, viewClass) {
    var self = this;

    /**
     * Private function which used as constructor.
     * @param  {String} serverURL - URL of the server
     * @param  {String} base - Base
     * @param  {String} viewClass - View class
     */
    function _initialize(serverURL, base, viewClass) {
        if (!serverURL) serverURL = DEFAULT_SERVER_URL;
        if (!base) base = DEFAULT_BASE;
        if (!viewClass) viewClass = DEFAULT_VIEW_CLASS;

        self.viewClass = viewClass;
        self.base = base;
        self.serverURL = serverURL;
    }

    /**
     * Requests and returns data.
     * @param  {String} focusNode - Focuse node id
     * @param  {function} successCallback - Handler
     * @param  {function} errorCallback - Handler
     */
    self.getGraphData = function (focusNode, successCallback, errorCallback) {

        if (!viewClass) viewClass = DEFAULT_VIEW_CLASS;

        var url = self.serverURL + '?' +
            '_base=' + self.base + '&' +
            '_viewClass=' + self.viewClass + '&' +
            'focusNode=' + encodeURIComponent(focusNode);
        fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            mode: 'cors',
            cache: 'default'
        })
        .then(function (response) {
            if (response.ok) {
                return response.json();
            } else {
                var error = new Error(response.statusText);
                error.response = response;
                throw error;
            }
        }).catch(function (error) {
            errorCallback(error.message);
        }).then(function (response) {
            successCallback(_filterData(response));
        });
    };

    /**
     * It is filtering response data. It's needed to remove duplicate nodes.
     * @param  {Object} data - Data
     * @returns {Object} Corrected data!
     */
    function _filterData (data) {
        var nodes = data.nodes;

        var newNodes = [];

        var findNodeById = function (nodeId) {
            for (var i = 0; i < newNodes.length; i++) {
                if (newNodes[i].id === nodeId) return newNodes[i];
            }
            return null;
        };

        nodes.forEach(function (node) {
            var baseNode = findNodeById(node.id);
            if (!baseNode) {
                node.canExpand = true;
                newNodes.push(node);
            }
        });

        data.nodes = newNodes;
        
        return data;
    }
    
    // Here we call constructor after defining all functions
    _initialize.call(self, serverURL, base, viewClass);
}

module.exports = DataProvider;


},{"es6-promise":1,"whatwg-fetch":5}],8:[function(require,module,exports){
'use strict';

var joint = require('rappid');
var uniqueId = require('lodash').uniqueId;
var cloneDeep = require('lodash').cloneDeep;

var defaultOptions = { ELEMENT_WIDTH: 130, ELEMENT_HEIGHT: 30, FULL_NODE_LABELS: false };
/**
 * Node of the graph.
 * It's a model of a graph element.
 *
 * Constructor parameters
 *      dataModel: {
 *          typeId: string,
 *          label: string,
 *          colorClass: string,
 *          fullNodeLabels: boolean,
 *      }
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number,
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public properties:
 *      dataModel: any
 *      parentEdge: Edge = null
 *      _edges: Edge[] = []
 *      expanded: boolean = false
 *      customPosition: boolean = false
 *      hasPosition: boolean = false
 *      hidden: boolean = false
 *      pagination: Pagination
 *      typeId: string
 *      fullLabel: boolean = false
 *
 * Public methods:
 *      reinit(): void
 *      setLayout(layout: GraphLayout): void
 *      isRootNode(): boolean
 *      nodePlacement(): boolean
 *      getSize(): { width: number, height: number}
 *      getParent(): Node
 *      getPrevNode(): Node | CrossNode
 *      hasChildren(): boolean
*       getChildren(expandCrossNodes?: boolean): (Node | CrossNode)[]
 *      getVisibleChildren(expandCrossNodes?: boolean): (Node | CrossNode)[]
 *      pushEdge(edge: Edge): voide
 *      getEdgeByType(typeId: string)
 *      disconnectEdge(edge: Edge): void
 *      setPagination(pagination: Pagination): void
 *      getPagination(): Pagination
 *      sortEdges(comparator: function): void
 *      getDirection(): boolean
 *      getDirectionRelativeToNode(relativeNode: Node): boolean
 *      setColorClass(colorClass: string): void
 *      getColorClass(): string
 *      badPosition(value: boolean): boolean
 *      addHighlighting(): void
 *      removeHighlighting(): void
 */
function Node (dataModel, _options) {
    var self = this;

    var ELEMENT_WIDTH = _options && _options.ELEMENT_WIDTH != undefined ? _options.ELEMENT_WIDTH : defaultOptions.ELEMENT_WIDTH;
    var ELEMENT_HEIGHT = _options && _options.ELEMENT_HEIGHT != undefined ? _options.ELEMENT_HEIGHT : defaultOptions.ELEMENT_HEIGHT;

    joint.shapes.devs.Model.apply(self, [{
        id: uniqueId('node_'),
        size: {width: ELEMENT_WIDTH, height: ELEMENT_HEIGHT},
        inPorts: ['left'],
        outPorts: ['right'],
        attrs: {
            '.inPorts circle': {r: 0, magnet: 'passive'},
            '.outPorts circle': {r: 0, magnet: 'passive'},
            rect: {
                rx: 20,
                ry: 160,
                'stroke-width': 2
            },
            '.label': {
                'font-size': 11,
                text: dataModel.label ? dataModel.label : 'Unnamed',
                fill: '#333'
            },
            'class': 'body ' + 'default-color-class'
        }
    }]);

    var _layout = null;
    var _colorClass = null;
    var _badPosition = false;
    var _edgeMap = {};

    self.pagination = null;
    self.dataModel = dataModel;
    self.parentEdge = null;
    self.edges = [];
    self.typeId = dataModel.typeId;
    self.set('fullLabel', dataModel.fullNodeLabels || defaultOptions.FULL_NODE_LABELS);

    self.set('expanded', false);
    self.set('customPosition', false); // true if node moved by user
    self.set('hasPosition', false); // true if node is located on _layout and there is way from him to root node
    self.set('hidden', true); // true if node has position, but not presents on graph
    
    self.configurationSet = {
        filterType: 'ALL', // INCOMING, OUTGOING
        filterKey: '',
        visibilityMap: {},
        visibilityMapReverse: {},
    };

    self.on('change:position', function () {
        _reBindEdges();
    });

    self.on('change:fullLabel', _calculateSize);

    self.reinit = function () {
        if (!_layout) return;

        _reBindEdges();

        if (_layout.getRootNode().id === self.id) {
            self.attr({
                rect: {
                    rx: 1,
                    ry: 5
                }
            });
            self.setColorClass('focus-node');
        }
    };

    self.setLayout = function (layout) {
        _layout = layout;
    };

    self.isRootNode = function () {
        return (_layout && _layout.getRootNode().id === self.id);
    };

    self.isReverseDirection = function () {
        return this.parentEdge.isReverseDirection;
    };

    self.nodePlacement = function () { // true - west; false - east;
        return (this.parentEdge && this.parentEdge.getOrientation() ? true : false);
    };

    self.getSize = function () {
        return self.get('size');
    };

    self.getParent = function () { // It can't be a CrossNode
        if (!self.parentEdge) return null;
        var prevNode = self.getPrevNode();
        if (!prevNode) return null;
        return (prevNode instanceof CrossNode ? prevNode.getParent() : prevNode);
    };

    self.getPrevNode = function () { // It can be a CrossNode
        if (!self.parentEdge) return null;
        return self.parentEdge.getOtherEnd(self);
    };

    self.hasChildren = function () {
        return (self.edges && self.edges.length > 0);
    };

    self.getChildren = function (expandCrossNodes) {
        var children = [];
        self.edges.forEach(function (edge) {
            var child = (edge.source.id === self.id ? edge.target : edge.source);
            if (child instanceof CrossNode && expandCrossNodes) {
                child.getChildren().forEach(function (chl2) {
                    children.push(chl2);
                });
            } else {
                children.push(child);
            }
        });
        return children;
    };

    self.getVisibleChildren = function (expandCrossNodes) {
        var children = [];
        self.edges.forEach(function (edge) {
            var child = (edge.source.id === self.id ? edge.target : edge.source);
            if (child instanceof CrossNode && expandCrossNodes) {
                child.getChildren().forEach(function (chl2) {
                    children.push(chl2);
                });
            } else if (!child.get('hidden')) {
                children.push(child);
            }
        });
        return children;
    };

    self.pushEdge = function (edge) {
        self.edges.push(edge);
        _edgeMap[edge.typeId + (edge.isReverseDirection ? '$$reverse' : '') + (edge.getOrientation() ? '$$west' : '$$east')] = edge;
    };

    self.getEdgeByType = function (typeId, isReverseDirection, orientation) {
        var res = _edgeMap[typeId + (isReverseDirection ? '$$reverse' : '') + (orientation ? '$$west' : '$$east')];
        return res;
    };

    self.disconnectEdge = function (edge) {
        if (self.parentEdge === edge) {
            self.parentEdge = null;
        } else {
            self.edges.splice(self.edges.indexOf(edge), 1);
            _edgeMap[edge.typeId + (edge.isReverseDirection ? '$$reverse' : '') + (edge.getOrientation() ? '$$west' : '$$east')] = null;
        }
    };

    self.setPagination = function (pagination) {
        self.pagination = pagination;
    };

    self.getPagination = function () {
        return self.pagination;
    };

    self.sortEdges = function (comparator) {
        if (self.edges) self.edges.sort(comparator);
    };

    /**
     * Returns position relative to center
     * false => on the left of the center
     * true => on the right of the center
     */
    self.getDirection = function () {
        var rootNode = _getRootForNode(self);
        if (rootNode && rootNode !== self) {
            return (_layout && self.position().x >= rootNode.position().x);
        } else {
            return !self.nodePlacement();
        }
    };

    /**
     * Returns position relative to the node
     * false => on the left of the relativeNode
     * true => on the right of the relativeNode
     */
    self.getDirectionRelativeToNode = function (relativeNode) {
        return (relativeNode && self.position().x > relativeNode.position().x);
    };

    /**
     * Sets new color class for node
     * @param {string} colorClass - css class
     */
    self.setColorClass = function (colorClass) {
        if (colorClass != undefined) {
            _colorClass = colorClass;
            self.dataModel.colorClass = colorClass;
        }
        _refreshColorClass();
    };

    /**
     * Returns color class
     * @returns {string} color class
     */
    self.getColorClass = function () {
        return _colorClass;
    };

    self.badPosition = function (value) {
        if (value != undefined) {
            _badPosition = value;
            _refreshColorClass();
        }
        return _badPosition;
    };
    
    self.addHighlighting = function () {
        self.attr('rect/stroke-width', 4);
    };
    
    self.removeHighlighting = function () {
        self.attr('rect/stroke-width', 2);
    };

    self.setParent = function (parentEdge) {
        self.parentEdge = parentEdge;
        // getting the configurationSet from parent
        var parent = self.getParent();
        if (parent && !self.configurationSet.modified) {
            self.configurationSet = cloneDeep(parent.configurationSet);
            self.configurationSet.connections = undefined;
            self.configurationSet.modified = false;
            self.configurationSet.expandTransitively = false;
        }
    };

    function _getRootForNode (node) {
        if (!node) return undefined;
        if (node.isRootNode() || node.get('customPosition')) {
            return node;
        } else {
            return _getRootForNode(node.getParent());
        }
    }

    function _refreshColorClass () {
        if (!_badPosition) {
            self.attr({
                rect: {
                    'class': 'body ' + _colorClass
                }
            });
            self.set('z', 100);
        } else {
            self.attr({
                rect: {
                    'class': 'body ' + _colorClass + ' bad-node-position'
                }
            });
            self.set('z', 200);
        }
    }

    function _calculateSize () {
        if (!self.dataModel.label) return;
        var label = self.dataModel.label;
        var wraptext = joint.util.breakText(label, {
            width: self.getSize().width
        });
        var rows = wraptext.split('\n');
        if (self.get('fullLabel')) {
            self.attr({
                '.label': {
                    text: wraptext
                }
            });
            var rowCount = rows.length - 1;
            var selfSize = self.getSize();
            var fontSize = self.attributes.attrs['.label']['font-size'];
            self.resize(selfSize.width, selfSize.height + rowCount * fontSize);
            selfSize = self.getSize();
            if (_layout && _layout.getRootNode().id === self.id) {
                self.attr({
                    rect: {
                        rx: 1,
                        ry: 5,
                        'class': 'body ' + ' focus-node'
                    }
                });
            } else {
                self.attr({
                    rect: {
                        rx: 20,
                        ry: 20 * (selfSize.width / selfSize.height) * 2
                    }
                });
            }
        } else {
            
            self.attr({
                '.label': {
                    text: (rows.length === 1 ? label : label.substring(0, wraptext.indexOf('\n')) + '...')
                }
            });
            self.resize(ELEMENT_WIDTH, ELEMENT_HEIGHT);
            if (_layout && _layout.getRootNode().id === self.id) {
                self.attr({
                    rect: {
                        rx: 1,
                        ry: 5,
                        'class': 'body ' + ' focus-node'
                    }
                });
            } else {
                self.attr({
                    rect: {
                        rx: 20,
                        ry: 160
                    }
                });
            }
        }
    }
    _calculateSize();

    function _reBindEdges () {
        var rebind = function (edge, direction) {
            if (direction) {
                edge.set('source', {id: edge.get('source').id, port: 'left'});
                edge.set('target', {id: edge.get('target').id, port: 'right'});
            } else {
                edge.set('target', {id: edge.get('target').id, port: 'left'});
                edge.set('source', {id: edge.get('source').id, port: 'right'});
            }
        };
        if (self.parentEdge) rebind(self.parentEdge, self.getPrevNode().position().x > self.position().x);
        if (self.edges) self.edges.forEach(function (edge) {
            rebind(edge, edge.getOtherEnd(self).position().x <= self.position().x);
        });
    }
}
Node.prototype = Object.create(joint.shapes.devs.Model.prototype);

/**
 * CrossNode of the graph.
 * It's a model of a graph element. Extend of Node.
 *
 * Constructor parameters:
 *      colorClass: string
 */
function CrossNode (colorClass) {
    var self = this;
    var DEFAULT_CROSS_NODE_OFFSET = 30; // It defines offset of the cross node relative to the next column position
    Node.apply(self, [{typeId: 'crossNode'}]);

    self.resize(5, 5);
    self.attr({
        rect: {
            rx: 500,
            ry: 500,
            'stroke-width': 2
        },
        '.label': {
            text: ''
        }
    });
    self.reinit = function () {
    };
    self.setColorClass(colorClass);

    self.getEdgeByType = function (typeId) {
        self.edges.filter(function (edge) { return edge.typeId === typeId; })[0];
    };

    self.alignRelativeToChildren = function (CROSS_NODE_OFFSET) {
        var offset = (CROSS_NODE_OFFSET != undefined ? CROSS_NODE_OFFSET : DEFAULT_CROSS_NODE_OFFSET);
        var children = self.getVisibleChildren();
        var filteredChildren = children.filter(function (ch) {
            return !ch.get('customPosition');
        });
        if (filteredChildren.length === 0 && children.length !== 0) {
            filteredChildren = children;
        } else if (children.length === 0) return;
        var firstChield = filteredChildren[0];
        var lastChield = filteredChildren[filteredChildren.length - 1];
        var firstChildPos = firstChield.position();
        var lastChieldPos = lastChield.position();
        var lastChieldSize = firstChield.getSize();
        var x = firstChildPos.x;
        var y = (lastChieldPos.y + firstChildPos.y + lastChieldSize.height - self.getSize().height) / 2;
        if (!self.nodePlacement()) x -= offset;
        if (self.nodePlacement()) x += lastChieldSize.width + offset;
        self.position(x, y);
    };

}
CrossNode.prototype = Object.create(Node.prototype);

/**
 * Edge of the graph.
 * It's a model of a graph link.
 *
 * Constructor parameters:
 *      dataModel: {
 *          typeId: string
 *          sourceTypeId: string,
 *          targetTypeId: string,
 *          label: string,
 *          colorTemplate?: {
 *              color: string, 
 *              colorFill: string, 
 *              colorFont: string,
 *              colorFillFocused: string
 *          },
 *          isReverseDirection?: boolean,
 *      }
 *
 * Public properties:
 *      dataModel: {dataModel}
 *      source: Node
 *      target: Node
 *      typeId: string
 *      sourceTypeId: string
 *      targetTypeId: string
 *
 * Public methods:
 *      getOtherEnd(me: Node): Node
 *      getOrientation(): boolean  // true - west; false - east;
 *      setSource(source: Node, isParent: boolean, port: string): void
 *      setTarget(source: Node, isParent: boolean, port: string): void
 *      disconnect(): void
 *      reverseEdgeDirection(): void
 *      setColorClass(colorClass: string): void
 */
function Edge (dataModel) {
    var self = this;

    joint.dia.Link.apply(self, [{
        z: 0,
        source: {id: null, port: 'right'},
        target: {id: null, port: 'left'},
        // smooth: true,
        // router: { name: 'orthogonal' },
        // router: { name: 'metro' },
        // connector: { name: 'rounded' },
        attrs: {
            '.connection': {
                'stroke-width': 2,
                'class': 'connection ' + (dataModel.colorClass ? dataModel.colorClass : 'default-color-class')
            }
        },
        labels: [{
            position: 0.5,
            attrs: {
                text: {
                    'class': (dataModel.colorClass ? dataModel.colorClass : 'default-color-class'),
                    'font-family': 'Arial, Helvetica, sans-serif',
                    'font-size': 11,
                    text: dataModel.label
                }
            }
        }]
    }]);

    self.isReverseDirection = false;
    self.source = null;
    self.target = null;
    self.dataModel = dataModel;
    self.sourceTypeId = dataModel.sourceTypeId;
    self.targetTypeId = dataModel.targetTypeId;
    self.typeId = dataModel.typeId;
    self.placement = dataModel.placement;

    self.getOtherEnd = function (me) {
        return (me.id === self.source.id ? self.target : self.source);
    };

    self.setSource = function (source, isParent, port) {
        self.set('source', {id: source.id, port: port});
        self.source = source;
        if (isParent) {
            self.source.pushEdge(self);
        } else {
            self.source.setParent(self);
        }
    };

    self.setTarget = function (target, isParent, port) {
        self.set('target', {id: target.id, port: port});
        self.target = target;
        if (isParent) {
            self.target.pushEdge(self);
        } else {
            self.target.setParent(self);
        }
    };

    self.disconnect = function () {
        self.target.disconnectEdge(self);
        self.source.disconnectEdge(self);
        self.remove();
    };

    self.setColorClass = function (colorClass) {
        self.attr({
            '.connection': {
                'class': 'connection ' + colorClass
            },
            '.marker-target': {
                'class': colorClass
            },
            '.marker-source': {
                'class': colorClass
            },
        });
        self.dataModel.colorClass = colorClass;
    };

    self.getOrientation = function () { // true - west; false - east;
        if (
            self.placement &&
            (self.placement === 'forward' || self.placement === 'backward')
        ) {
            return self.isReverseDirection &&
                   self.placement === 'forward' ||
                   !self.isReverseDirection &&
                   self.placement === 'backward';
        } else {
            return self.isReverseDirection;
        }
    };
    
    /**
     * Functions which reverses the direction 
     * of the Edge (For the first iteration)
     */
    self.reverseEdgeDirection = function (isReverseDirection) {
        if (self.isReverseDirection !== isReverseDirection) {
            self.isReverseDirection = isReverseDirection;
            var targetId = self.targetTypeId;
            self.targetTypeId = self.sourceTypeId;
            self.sourceTypeId = targetId;
            self.updateMarker();
        }
    };

    self.updateMarker = function () {
        var marker = {
            'stroke-width': 2,
            'class': (dataModel.colorClass ? dataModel.colorClass : 'default-color-class'),
            d: 'M0 32 L8 35 L11 32 L08 29 Z' // M10 34 L0 32 L10 30 Z //M 10 0 L 0 5 L 10 10 z - fatter arrow
        };
        var attrs = {
            '.marker-target': (self.targetTypeId !== 'crossNode' && !self.isReverseDirection ? marker : { d: '' }),
            '.marker-source': (self.sourceTypeId !== 'crossNode' && self.isReverseDirection ? marker : { d: '' })
        };
        self.attr(attrs);
    }
    self.updateMarker();
}
Edge.prototype = Object.create(joint.dia.Link.prototype);

module.exports = {
    Node: Node,
    CrossNode: CrossNode,
    Edge: Edge
};


},{"lodash":"lodash","rappid":"rappid"}],9:[function(require,module,exports){
'use strict';

var Node = require('./graphElements').Node,
    CrossNode = require('./graphElements').CrossNode,
    Edge = require('./graphElements').Edge;

var Pagination = require('./pagination');

var LayoutPaginationManager = require('./layoutPaginationManager');
var LayoutPositionManager = require('./layoutPositionManager');

var ColorConfigurator = require('./colorConfigurator');

/**
 * Layout of the graph.
 * Contain all graph elements, controls the placement of nodes.
 *
 * Constructor parameters:
 *      graph: joint.dia.Graph
 *      paper: joint.dia.Paper
 *      scroller: joint.ui.PaperScroller
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      cleanLayout(): void
 *      setRootNode(rootNode: Node): void
 *      getRootNode(): Node
 *      getNodes(): Node[]
 *      getEdges(): Edge[]
 *      removeEdge(edge: Edge): void
 *      collapseNode(unbindFromId: string): void
 *      removeNode(node: Node, removeChildren: boolean = false): void
 *      putAll(cells: (Node|Edge), bindToId?: string): void - (by default: bindToId = _rootNode.id)
 *      put(cell: (Node|Edge), bindToId?: string): void
 *      cloneNode(node: Node): Node
 *      recalculateLayout(): void
 *      getScale(): {sx: number, sy: number}
 *      hideNode(node: Node): void
 *      showNode(node: Node): void
 *      doForBrunch(node: Node, callBack: function): void
 */
function GraphLayout (graph,
                     paper,
                     scroller,
                     _options) {
    var self = this;

    /**
     * Private filds
     */
    var _graph = null;
    var _rootNode = null;
    var _nodesById = null;
    var _nodesByType = null;
    var _edges = null;
    var _scroller = null;
    var _positionManager = null;
    var _paginationManager = null;
    var _colorConfigurator = null;

    /**
     * Private function which used as constructor.
     * @param  {joint.dia.Graph} graph - joint.dia.Graph
     * @param  {joint.dia.Paper} paper - joint.dia.Paper
     * @param  {joint.ui.PaperScroller} scroller - joint.ui.PaperScroller
     */
    function _initialize (graph, paper, scroller) {

        _graph = graph;
        _scroller = scroller;

        _positionManager = new LayoutPositionManager(_options);
        _paginationManager = new LayoutPaginationManager(self, _options);

        _colorConfigurator = new ColorConfigurator();

        self.blockValidation = false;
        self.cleanLayout();
    }

    self.loadState = function (state) {
        if (_rootNode) self.cleanLayout();
        
        _rootNode = state.rootNode;
        _edges = state.edges;
        _nodesById = {};
        _nodesByType = {};
        state.nodes.forEach(function (node) {
            if (node.getPrevNode()) {
                _embedNode(node, node.getPrevNode());
            }
            if (node.pagination) {
                _embedNode(node.pagination, node);
            }
            if (!_nodesByType[node.typeId]) _nodesByType[node.typeId] = [];
            _nodesByType[node.typeId].push(node);
            _nodesById[node.id] = node;
        });
        _graph.addCells(state.visibleElements);
    };

    self.getState = function () {
        return {
            rootNode: _rootNode,
            edges: _edges,
            nodes: self.getNodes(),
            visibleElements: _graph.getElements()
            .concat(_graph.getLinks()),
        };
    };

    /**
     * Returns value of scale by x and y axis
     */
    self.getScale = function () {
        return {sx: _scroller._sx, sy: _scroller._sy};
    };

    /**
     * Function is used for clean layout and remove all nodes and edges.
     */
    self.cleanLayout = function () {
        _rootNode = null;
        _nodesById = {};
        _nodesByType = {};
        _edges = [];
        _graph.clear();
    };

    /**
     * Sets root node for layout.
     * If we there is one, then we clean layout.
     * @param {Node} rootNode - Node which will be used as root
     */
    self.setRootNode = function (rootNode) {
        if (_rootNode) self.cleanLayout();

        _rootNode = rootNode;
        _putNode(rootNode);
        _rootNode.set('expanded', true);

        _locateNode(_rootNode, rootNode.id);
        self.showNode(_rootNode);
    };

    /**
     * Returns root node of layout.
     * @returns {Array} Nodes of the layout
     */
    self.getRootNode = function () {
        return _rootNode;
    };

    /**
     * Returns all nodes of the layout.
     * @returns {Array} Edges of the layout
     */
    self.getNodes = function () {
        return Object.keys(_nodesById).filter(function (id) {
            return _nodesById[id];
        }).map(function (id) {
            return _nodesById[id];
        });
    };

    /**
     * Returns all edges of the layout.
     */
    self.getEdges = function () {
        return _edges;
    };

    /**
     * Implements opportunity to remove edge from the layout
     * @param {Edge} edge - Edge which must be removed
     */
    self.removeEdge = function (edge) {
        _edges.splice(_edges.indexOf(edge), 1);
        edge.disconnect();
    };

    /**
     * Collapses node and removes all children
     * of the Node from the layout
     * @param {string} unbindFromId - Id of the node from layout
     */
    self.collapseNode = function (unbindFromId) {
        if (_nodesById[unbindFromId]) {
            var node = _nodesById[unbindFromId];
            if (node.id === _rootNode.id) {
                self.leftTree = [];
                self.rightTree = [];
            }
            _paginationManager.removePagination(node);
            var children = node.getChildren();
            children.forEach(function (ch) {
                self.removeNode(ch, true);
            });
        }
    };

    /**
     * Removes node from the layout and (if needed) removes all his children
     * @param {string} node - Id of the node from layout
     * @param {boolean} removeChildren - If true then children will be removed
     */
    self.removeNode = function (node, removeChildren) {
        _paginationManager.removePagination(node);

        if (node.parentEdge) self.removeEdge(node.parentEdge);
        node.set('hasPosition', false);

        if (removeChildren) {
            var children = node.getChildren();
            children.forEach(function (ch) {
                self.removeNode(ch, true);
            });
        }
        
        if (_nodesById[node.id]) _nodesById[node.id] = null;
        if (_nodesByType[node.typeId] && _nodesByType[node.typeId].length > 0)
            _nodesByType[node.typeId].splice(_nodesByType[node.typeId].indexOf(node), 1);

        if (!node.get('hidden')) self.hideNode(node);
    };

    /**
     * Adds all nodes or edges on the layout
     * @param {Array} cells - Array of cells (Edge|Node)
     * @param {string} bindToId - Source node
     * which will be added on the layout
     */
    self.putAll = function (cells, bindToId) {
        cells.forEach(function (cell) {
            self.put(cell, bindToId);
        });
    };

    /**
     * Adds one node or edge on the layout
     * @param {Node|Edge} cell - Cell which
     * @param {string} bindToId - Source node
     * will be added on the layout
     */
    self.put = function (cell, bindToId) {
        if (cell instanceof Node) {
            _putNode(cell);
        } else if (cell instanceof Edge) {
            _putEdge(cell, bindToId);
        } else if (cell instanceof Pagination) {
            _putPagination(cell, bindToId);
        }
    };

    /**
     * Relocates all nodes of layout on their position
     */
    self.recalculateLayout = function () {
        if (!_rootNode) return;

        self.blockValidation = true;

        var x = _rootNode.position().x;
        var y = _rootNode.position().y;

        if (!_rootNode.get('customPosition')) {
            var ph = _scroller.options.baseHeight;
            var pw = _scroller.options.baseWidth;
            x = (pw - _rootNode.getSize().width) / 2;
            y = (ph - _rootNode.getSize().height) / 2;

            var dx = x - _rootNode.position().x;
            var dy = y - _rootNode.position().y;
            _rootNode.translate(dx, dy);
        }

        _paginationManager.paginateNode(_rootNode);

        _positionManager.calculateLayoutForNode(_rootNode);

        _paginationManager.setPaginationPosition(_rootNode);
        
        self.blockValidation = false;
    };

    /**
     * Implements opportunity to create copy of any Node
     * @param {Node} node - The copied node
     */
    self.cloneNode = function (node) {
        return new Node({
            typeId: node.dataModel.typeId,
            label: node.dataModel.label,
            colorClass: node.dataModel.colorClass,
            canExpand: node.dataModel.canExpand
        });
    };

    /**
     * Hides one node - removes only from graph, not from layout.
     * @param {Node} node - Node which will be hidden
     */
    self.hideNode = function (node) {
        if (!node.get('hidden')) {
            node.remove();

            var prev = node.getPrevNode();
            if (prev) _unembedNode(node, prev);
            
            node.set('hidden', true);
            _paginationManager.hidePagination(node);
            node.getChildren().forEach(function (ch) {
                self.hideNode(ch);
            });
        }
    };

    /**
     * Shows one node - puts node on the graph.
     * @param {Node} node - Node which will be showed
     * @param {boolean} withoutChildren - if true children aren't counted
     */
    self.showNode = function (node, withoutChildren) {
        if (node.get('hidden')) {
            _graph.addCell(node);
            if (node.parentEdge) {
                self.showNode(node.getPrevNode());
                _graph.addCell(node.parentEdge);
            }
            node.set('hidden', false);

            var prev = node.getPrevNode();
            if (prev) _embedNode(node, prev);

            _paginationManager.showPagination(node);
            if (!withoutChildren) {
                node.getChildren().forEach(function (ch) {
                    self.showNode(ch);
                });
            }
        }
    };

    /**
     * Performs action for branch
     * @param {Node} node - root node of the branch
     * @param {function} callBack - performed action
     */
    self.doForBrunch = function (node, callBack) {
        node.getChildren().forEach(function (child) {
            self.doForBrunch(child, callBack);
        });
        callBack(node);
    };

    //Private functions
    //=========================================================
    //=========================================================

    /**
     * Adds and embeds pagination to node
     * @param {Pagination} pagination - Pagination for node
     * @param {string} nodeId - edges of this node will be poginated
     */
    function _putPagination (pagination, nodeId) {
        if (_nodesById[nodeId] && !_nodesById[nodeId].get('hidden')) {
            _graph.addCell(pagination);
            _nodesById[nodeId].embed(pagination);
        }
    }

    /**
     * Adds node to the node list (not on layout)
     * Not does it if edge already exists
     * @param {Node} node - New node
     * @param {boolean} ignorRepeated - Ignore repeating
     */
    function _putNode (node, ignorRepeated) {
        if (!_nodesByType[node.typeId] || _nodesByType[node.typeId].length === 0 || ignorRepeated) {
            if (!_nodesByType[node.typeId]) _nodesByType[node.typeId] = [];

            if (_nodesByType[node.typeId].indexOf(node) === -1) _nodesByType[node.typeId].push(node);
            _nodesById[node.id] = node;
            node.setLayout(self);
        }
    }

    /**
     * Adds edge to the edge list, then
     * add source and target and source node
     * on the layout (if they aren't yet) and
     * next adds edge on the layout.
     * Not does it if edge already exists
     * @param {Edge} edge - New edge
     * @param {string} bindToId - Id of the source node
     */
    function _putEdge (edge, bindToId) {
        if (!bindToId || !_nodesById[bindToId]) bindToId = _rootNode.id;

        if (_nodesByType[edge.sourceTypeId] &&
            _nodesByType[edge.targetTypeId] &&
            edge.targetTypeId === _nodesById[bindToId].typeId) {
            
            edge.reverseEdgeDirection(true);
        }

        var port = _getSourcePort(edge, _nodesById[bindToId]);
        if (port === _nodesById[bindToId]) {
            var completeEdge = _enrichEdge(edge, bindToId);

            if (completeEdge) {

                if (!completeEdge.target.get('hasPosition')) {
                    _putNode(completeEdge.target, true);
                    _locateNode(completeEdge.target, bindToId);
                }

                if (!completeEdge.source.get('hasPosition')) {
                    _putNode(completeEdge.source, true);
                    _locateNode(completeEdge.source, bindToId);
                }
                _edges.push(completeEdge);
            }
        } else {
            _putEdge(edge, port.id);
        }
    }

    /**
     * It Checks there is same edge in the layout
     * @param {Edge} newEdge - New edge
     * @param {string} bindToId - Id of the source node
     * @returns {boolean}
     */
    function _isEdgeExists (newEdge, bindToId) {
        return _edges.filter(function (edge) {
            if (newEdge.isReverseDirection === edge.isReverseDirection || newEdge.isReverseDirection && edge.isReverseDirection) {
                return ( edge.typeId === newEdge.typeId &&
                    edge.sourceTypeId === newEdge.sourceTypeId) &&
                    edge.targetTypeId === newEdge.targetTypeId &&
                    (
                        edge.source.id === bindToId ||
                        edge.target.id === bindToId
                    );
            } else {
                return ( edge.typeId === newEdge.typeId &&
                    edge.sourceTypeId === newEdge.targetTypeId) &&
                    edge.targetTypeId === newEdge.sourceTypeId &&
                    (
                        edge.source.id === bindToId ||
                        edge.target.id === bindToId
                    );
            }
        }).length > 0;
    }

    /**
     * Get source and target type ids, and basing on it,
     * puts concrete source and target objects into edge
     * @param {Edge} edge - Edge
     * @param {string} bindToId - Id of the source node
     * @returns {Edge} Enriched edge
     */
    function _enrichEdge (edge, bindToId) {
        if (_isEdgeExists(edge, bindToId)) return null;
        
        if (!bindToId) bindToId = _rootNode.id;

        if (_nodesByType[edge.sourceTypeId] &&
            _nodesByType[edge.targetTypeId] &&
            edge.sourceTypeId === _nodesById[bindToId].typeId
        ) {
            var source = _nodesById[bindToId];
            var target = _getFreeNodeByType(edge.targetTypeId);
            if (!target && _nodesByType[edge.targetTypeId][0]) {
                target = self.cloneNode(_nodesByType[edge.targetTypeId][0]);
            }

            edge.setSource(source, true);
            edge.setTarget(target, false);

            edge.setColorClass(_colorConfigurator.getColorClassForElement(edge.dataModel.label));
            target.setColorClass(edge.dataModel.colorClass);
            return edge;
        }
        return null;
    }

    /**
     * Returns (target/source) node as a port, or, if there are edges 
     * with same type, it will return crossNode
     * @param {Edge} edge - Edge
     * @param {Node} rootNode - (target/source) node, which is for contecting by edge
     * @returns {Node} (target/source or crossNode)
     */
    function _getSourcePort (edge, rootNode) {
        if (rootNode.typeId === 'crossNode') {
            edge.set('labels', []);
            edge.sourceTypeId = 'crossNode';
            edge.updateMarker();
            return rootNode;
        }

        var existedEdge = rootNode.getEdgeByType(edge.typeId, edge.isReverseDirection, edge.getOrientation());

        if (!existedEdge) {
            return rootNode;
        } else {
            var crossNode;
            if (existedEdge.targetTypeId !== 'crossNode' && existedEdge.sourceTypeId !== 'crossNode') {
                var target = existedEdge.target;
                var source = existedEdge.source;
                self.removeEdge(existedEdge);

                crossNode = new CrossNode(existedEdge.dataModel.colorClass);
                _putNode(crossNode, true);

                var typeEdge = new Edge({
                    typeId: existedEdge.dataModel.typeId,
                    sourceTypeId: existedEdge.sourceTypeId,
                    targetTypeId: 'crossNode',
                    label: existedEdge.dataModel.label,
                    colorClass: existedEdge.dataModel.colorClass,
                    placement: existedEdge.placement,
                });

                typeEdge.isReverseDirection = edge.isReverseDirection;
                typeEdge.updateMarker();
                typeEdge.setSource(source, true, 'left');
                typeEdge.setTarget(crossNode, false, 'right');
                _edges.push(typeEdge);
                
                _locateNode(crossNode, rootNode.id);

                var secondPart = new Edge({
                    typeId: existedEdge.dataModel.typeId,
                    sourceTypeId: 'crossNode',
                    targetTypeId: existedEdge.targetTypeId,
                    label: '',
                    colorClass: existedEdge.dataModel.colorClass,
                    placement: existedEdge.placement,
                });

                secondPart.isReverseDirection = edge.isReverseDirection;
                secondPart.updateMarker();
                secondPart.setSource(crossNode, true, 'left');
                secondPart.setTarget(target, false, 'right');
                _edges.push(secondPart);
            } else {
                crossNode = existedEdge.target;
            }

            return crossNode;
        }
    }

    /**
     * Get node from the node list.
     * If node is present on diagram, returns copy.
     * @param {string} typeId - Id of the source node
     * @returns {Node} Free node
     */
    function _getFreeNodeByType (typeId) {
        var nodes = _nodesByType[typeId];
        if (!nodes || nodes.length === 0) return null;
        for (var i = 0; i < nodes.length; i++) {

            if (!nodes[i].get('hasPosition')) return nodes[i];
        }
        return null;
    }

    /**
     * Puts node into layout.
     * @param {Node} node - Node which will be posted
     * @param {string} bindToId - Source node
     */
    function _locateNode (node) {
        if (!_rootNode) {
            self.setRootNode(node);
        }

        node.set('hasPosition', true);
        node.reinit();
        // self.recalculateLayout();
    }

    /**
     * Embed a node into parent node
     * @param {Node} node - Node of the branch
     * @param {Node} parent - Parent node
     */

    function _embedNode (node, parent) {
        if (!node.isEmbeddedIn(parent)) parent.embed(node);
    }

    /**
     * Free up an embedded node from parent node
     * @param {Node} node - Node of the branch
     * @param {Node} parent - Parent node
     */
    function _unembedNode (node, parent) {
        if (node.isEmbeddedIn(parent)) parent.unembed(node);
    }

    //Here we call constructor after defining all functions
    _initialize.call(self, graph, paper, scroller);
}
module.exports = GraphLayout;


},{"./colorConfigurator":6,"./graphElements":8,"./layoutPaginationManager":13,"./layoutPositionManager":14,"./pagination":17}],10:[function(require,module,exports){
var TQGramUI = require('visualizations-library');
var InfoPanel = require('./infoPanel');
var OptionsPanel = require('./optionsPanel');

function DefaultUI (options) {
    // Initialization
    // =======================================================
    var _neighborGram = options.lineageGram;
    var markup = '<div class="tq-ng-default-user-ui">' +
        '<div id="tqLgToolbar"></div>' +
        '<div id="tqLgInfoPanel"></div>' +
        '<div id="tqLgOptionsPanel"></div>' +
        '<div id="tqLgSearchPanel"></div>' +
    '</div>';

    var _el;
    if (typeof options.baseElement === 'string') {
        _el = document.getElementById(options.baseElement);
    } else if (typeof options.baseElement === 'object') {
        _el = options.baseElement;
    }
    if (!_el) return;
    _el.innerHTML = markup;

    var tqLgToolbar = _el.querySelector('#tqLgToolbar');
    var tqLgInfoPanel = _el.querySelector('#tqLgInfoPanel');
    var tqLgOptionsPanel = _el.querySelector('#tqLgOptionsPanel');
    var tqLgSearchPanel = _el.querySelector('#tqLgSearchPanel');
    var _expandAll = true;
    // ========================================================

    // Toolbar
    var toolbar = new TQGramUI.Toolbar({
        baseElement: tqLgToolbar,
        tools: [
            {
                id: 'tqLgSearchButton',
                icon: 'glyphicon glyphicon-search',
                label: 'Search',
            },
            {
                id: 'tqNgUndo',
                icon: 'glyphicon glyphicon-menu-left',
                label: 'Back',
                callback: function () {
                    _neighborGram.undoState();
                },
            },
            {
                id: 'tqNgRedo',
                icon: 'glyphicon glyphicon-menu-right',
                label: 'Forward',
                callback: function () {
                    _neighborGram.redoState();
                },
            },
            {
                id: 'tqLgZoomIn',
                icon: 'glyphicon glyphicon-zoom-in',
                label: 'Zoom in',
                callback: function () {
                    _neighborGram.zoom(0.2, { max: 4 });
                },
            },
            {
                id: 'tqLgZoomOut',
                icon: 'glyphicon glyphicon-zoom-out',
                label: 'Zoom out',
                callback: function () {
                    _neighborGram.zoom(-0.2, { min: 0.2 });
                },
            },
            {
                id: 'zoomToFit',
                icon: 'glyphicon glyphicon-fullscreen',
                label: 'Zoom to fit',
                callback: function () {
                    _neighborGram.zoom();
                },
            },
            {
                id: 'tqLgReset',
                icon: 'glyphicon glyphicon-refresh',
                label: 'Reset layout',
                callback: function () {
                    _neighborGram.getNodes().forEach(function (node) {
                        node.set('customPosition', false);
                    });
                    _neighborGram.refreshLayout();
                },
            },
            {
                id: 'expandAll',
                icon: 'glyphicon glyphicon-resize-full',
                icon2: 'glyphicon glyphicon-resize-small',
                label: 'Expand labels',
                callback: function () {
                    _neighborGram.fullNodeLabels(_expandAll);
                    _expandAll = !_expandAll;               
                },
            },
            '<div style="flex-grow: 1"></div>',
            {
                id: 'infoPanelBtn',
                icon: 'glyphicon glyphicon-info-sign',
                label: 'Node info',
            },
            {
                id: 'tqLgOptionsButton',
                icon: 'glyphicon glyphicon-menu-hamburger',
                label: 'Options',
            },
        ],
    });

    new TQGramUI.SearchPanel({
        baseElement: tqLgSearchPanel,
        triggerButton: toolbar.rootHtml.querySelector('#tqLgSearchButton'),
        header: 'Search this NeighborGram™',
        searchButtonId: 'tqNgSearchBtn',
        searchId: 'tqNgSearch',
        active: false,
    });

    new OptionsPanel({
        neighborGram: _neighborGram,
        baseElement: tqLgOptionsPanel,
        active: false,
        triggerButton: toolbar.rootHtml.querySelector('#tqLgOptionsButton'),
        legends: options.legends,
    });

    new InfoPanel({
        baseElement: tqLgInfoPanel,
        active: false,
        triggerButton: toolbar.rootHtml.querySelector('#infoPanelBtn'),
        neighborGram: _neighborGram,
    });

}
module.exports = DefaultUI;

},{"./infoPanel":11,"./optionsPanel":12,"visualizations-library":4}],11:[function(require,module,exports){
var graphElements = require('../graphElements');
var Subscribable = require('../subscriptionAPI/subscribeable');
var TQGramUI = require('visualizations-library');

function InfoPanel (options) {
    Subscribable.apply(this);   // make this class Subscribable

    var infoTemplate = new TQGramUI.InfoPanel({
        placeholder: 'Select a node',
    });
    var _neighborGram = options.neighborGram;

    TQGramUI.FlyingPanel.apply(this, [{
        baseElement: options.baseElement,
        active: options.active,
        header: 'Node Info',
        triggerButton: options.triggerButton,
        emptyBody: false,
        size: { width: '300px', height: '450px'},
        body: infoTemplate,
    }]);

    _neighborGram.onNodeSelected(_setSelectedElement);

    infoTemplate.on('selected-element-changed', function (selectedId) {
        var nodes = _neighborGram.getNodes();
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === selectedId) {
                _neighborGram.setSelectedNode(nodes[i]);
                _setSelectedElement(nodes[i]);
                break; 
            }
        }
    });

    function _setSelectedElement (element) {
        if (element && element instanceof graphElements.Node && element.dataModel) {
            var node = element;
            var model = node.dataModel;

            infoTemplate.setSelectedElement({
                id: node.id,
                label: model.label,
                types: model.typeId,
                data: model.data,
                relations: _getRelations(element),
            });

        } else {
            infoTemplate.setSelectedElement();
        }
    }

    function _getRelations (element) {
        var parentNode = element.getParent();
        var relatedNodes = element.getChildren(true);

        var sources = relatedNodes.filter(function (n) {
            return (!n.getDirectionRelativeToNode(element));
        });
        if (parentNode && (!element.isReverseDirection())) {
            sources.push(parentNode);
        }
        
        var targets = relatedNodes.filter(function (n) {
            return (n.getDirectionRelativeToNode(element));
        });
        if (parentNode && (element.isReverseDirection())) {
            targets.push(parentNode);
        }
        
        if (sources && sources.length > 0 || targets && targets.length > 0) {
            return {
                incomings: sources.map(function (el) { 
                    return {
                        id: el.id,
                        label: el.dataModel.label,
                    };
                }),
                outgoings: targets.map(function (el) { 
                    return {
                        id: el.id,
                        label: el.dataModel.label,
                    };
                }),
            };
        }
        return undefined;
    }
            
}
module.exports = InfoPanel;

},{"../graphElements":8,"../subscriptionAPI/subscribeable":20,"visualizations-library":4}],12:[function(require,module,exports){
var Subscribable = require('../subscriptionAPI/subscribeable');
var TQGramUI = require('visualizations-library');

function OptionsPanel (options) {
    Subscribable.apply(this);   // make this class Subscribable

    var _legends = options.legends || [];
    var _neighborGram = options.neighborGram;
    var self = this;

    TQGramUI.FlyingPanel.apply(this, [{
        baseElement: options.baseElement,
        active: options.active,
        header: 'Options',
        triggerButton: options.triggerButton,
        removeBackground: true,
        size: {
            width: '400px',
            height: '500px',
        },
        body: new TQGramUI.TabPanel({
            tabs: [
                {
                    id: 'tqUiGeneral',
                    label: 'General',
                    body:
                        '<label for="exportGroup" class="tq-label">Export as</label>                                ' +
                        '<div id="exportGroup" class="tq-ui-group tq-ui-export-group">                              ' +
                        '    <button id="tqUiExportSVG" title="Export diagram to SVG" class="tq-button">SVG</button>' +
                        '    <button id="tqUiExportPNG" title="Export diagram to PNG" class="tq-button">PNG</button>' +
                        '</div>                                                                                     ' +
                        '<label for="howToUseGroup" class="tq-label">How to use</label>                             ' +
                        '<div id="howToUseGroup" class="tq-ui-group tq-ui-opt-group">                               ' +
                        '    <button id="tqUiHelpBtn" title="Help" class="tq-button">                               ' +
                        '        <span class="glyphicon glyphicon-info-sign" aria-hidden="true"></span>             ' +
                        '    </button>                                                                              ' +
                        '    <a class="tq-button" title="Documentation" href="./documentation/index.html">DOC</a>   ' +
                        '</div>                                                                                     ',
                },
                {
                    id: 'tqUiLegends',
                    label: 'Legends',
                    body: new TQGramUI.Legends({legends: _legends}),
                },
            ]
        }),
    }]);

    // General

    var svgButton = self.rootHtml.querySelector('#tqUiExportSVG');
    var pngButton = self.rootHtml.querySelector('#tqUiExportPNG');
    var helpButton = self.rootHtml.querySelector('#tqUiHelpBtn');

    svgButton.onclick = function () {
        _neighborGram.export({
            type: 'svg',
        });
    };

    pngButton.onclick = function () {
        _neighborGram.export({
            type: 'png',
        });
    };

    helpButton.onclick = options.onPressHelp;
}
module.exports = OptionsPanel;

},{"../subscriptionAPI/subscribeable":20,"visualizations-library":4}],13:[function(require,module,exports){
'use strict';

var Pagination = require('./pagination');

var CrossNode = require('./graphElements').CrossNode;

// They are used when we need to locate nodes on the graph
var defaultOptions = {
    DEFAULT_PAGE_SIZE: 5
};

/**
 * LayoutPaginationManager.
 * Manage pagination.
 *
 * Constructor parameters:
 *      _layout: GraphLayout
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      paginateNodes(nodes: Array): void
 *      paginateNode(rootNode: Node): void
 *      hidePagination(node: Node): void
 *      showPagination(node: Node): void
 *      removePagination(node: Node): void
 *      setPaginationPosition(node: Node): void
 *      defaultEdgeComparator(edge1: Edge, edge2: Edge): number
 */
function LayoutPaginationManager (_layout,
                                 _options) {
    var self = this;

    var DEFAULT_PAGE_SIZE = (_options && _options.DEFAULT_PAGE_SIZE != undefined ? _options.DEFAULT_PAGE_SIZE : defaultOptions.DEFAULT_PAGE_SIZE);

    /**
     * It does pagination for all nodes from the list
     * @param {Array} nodes - array of nodes
     */
    self.paginateNodes = function (nodes) {
        if (nodes) nodes.forEach(function (node) {
            self.paginateNode(node);
        });
    };

    /**
     * It does pagination for the node and for his children
     * @param {Node} rootNode
     */
    self.paginateNode = function (rootNode) {
        if (!rootNode.get('hidden')) {
            var children = _paginateAndSortChildrenOfNode(rootNode);
            self.paginateNodes(children);
        }
    };

    /**
     * Hide the pagination element
     * @param {Node} node
     */
    self.hidePagination = function (node) {
        if (node.getPagination()) {
            node.getPagination().remove();
        }
    };

    /**
     * Show the pagination element
     * @param {Node} node
     */
    self.showPagination = function (node) {
        if (node.getPagination()) {
            _layout.put(node.getPagination(), node.id);
        }
    };

    /**
     * Removes the pagination element from the graph
     * @param {Node} node
     */
    self.removePagination = function (node) {
        if (node.getPagination()) {
            node.getPagination().remove();
            node.setPagination(null);
        }
    };

    /**
     * Calculates the new position of the pagination element and moves it to that position
     * @param {Node} node
     */
    self.setPaginationPosition = function (node) {
        if (node.getPagination()) {
            var pagination = node.getPagination(),
                x = 0,
                y = 0;
            var scale = _layout.getScale();
            var paginationWidth = pagination.get('size').width / scale.sx;
            var paginationHeight = pagination.get('size').height / scale.sy;

            if (pagination.getType() === 'nodes') {
                if (node.id === _layout.getRootNode().id) {
                    x = node.position().x + (node.getSize().width - paginationWidth) / 2;
                    y = node.position().y - paginationHeight - (5 / scale.sy);
                } else {
                    var children = node.getChildren().filter(function (child) {
                            return !child.get('hidden') && !child.get('customPosition');
                        }),
                        firstNode;

                    if (children.length) firstNode = children[0];

                    if (firstNode) {
                        x = firstNode.position().x + (firstNode.getSize().width - paginationWidth) / 2;
                        y = firstNode.position().y - paginationHeight - (5 / scale.sy);
                    } else {
                        x = node.position().x - paginationWidth - (3 / scale.sx);
                        y = node.position().y + (node.getSize().height - paginationHeight) / 2;
                    }
                }
            } else {
                x = node.position().x + (node.getDirection() ? node.getSize().width + (3 / scale.sx) : -paginationWidth - (3 / scale.sx));
                y = node.position().y + (node.getSize().height - paginationHeight) / 2;
            }
            if (pagination.position().x == x && pagination.position().y == y) {
                pagination.updateViewPosition();
            } else {
                pagination.set('position', {x: x, y: y});
            }
        }

        node.getChildren().forEach(function (child) {
            self.setPaginationPosition(child);
        });
    };

    /**
     * Function comparator for sorting child-branches of the node
     * @param  {Edge} edge1
     * @param  {Edge} edge2
     * @returns {number}
     */
    self.defaultEdgeComparator = function (edge1, edge2) {
        var node1 = (edge1.target ? edge1.target : {dataModel: {}});
        var node2 = (edge2.target ? edge2.target : {dataModel: {}});

        var a = null;

        if (node1 instanceof CrossNode && node1.hasChildren()) {
            node1.sortEdges(self.defaultEdgeComparator);
            a = node1.getChildren()[0].dataModel.label;
        } else {

            a = node1.dataModel.label;
        }
        if (a) a = a.toLowerCase();

        var b = null;
        if (node2 instanceof CrossNode && node2.hasChildren()) {
            node2.sortEdges(self.defaultEdgeComparator);
            b = node2.getChildren()[0].dataModel.label;
        } else {
            b = node2.dataModel.label;
        }
        if (b) b = b.toLowerCase();

        if (a > b) {
            return 1;
        }
        if (a < b) {
            return -1;
        }
        return 0;
    };

    /**
     * Returns only nodes which exists on current page and hides other nodes.
     * @param {Node} rootNode - Parent of the paginated nodes
     * @retunrs {Array} Nodes which exists on current page
     */
    function _paginateAndSortChildrenOfNode (rootNode) {
        var maxPageSize = (rootNode.isRootNode() ? DEFAULT_PAGE_SIZE * 2 : DEFAULT_PAGE_SIZE);

        rootNode.sortEdges(self.defaultEdgeComparator);
        var children = rootNode.getChildren();
        
        if (children.length > maxPageSize) {
            if (!rootNode.getPagination()) {
                _createPagination(rootNode, maxPageSize);
            }
            return _paginate(children, rootNode.getPagination().getState());
        } else {
            children.forEach(function (node) {
                _layout.showNode(node, true);
            });
            return children;
        }
    }


    /**
     * Paginates array of nodes.
     * @param {Array} nodes - Array of nodes
     * @param {Object} pagination - { pageSize:number, curPage:number, totalCount:number, pageCount:number }
     * @retunrs {Array} Nodes which exists on current page
     */
    function _paginate (nodes, pagination) {
        var paginatedNodes = [];
        var curMin = pagination.curPage * pagination.pageSize;
        var curMax = (pagination.curPage + 1) * pagination.pageSize;
        for (var index = 0; index < nodes.length; index++) {
            var node = nodes[index];
            if (index >= curMin && index < curMax) {
                _layout.showNode(node, true);
                paginatedNodes.push(node);
            } else {
                _layout.hideNode(node);
            }
        }
        return paginatedNodes;
    }

    /**
     * Creates the pagination element, adds it to the graph and embeds it into the node
     * @param {Node} node
     * @param {number} max - maximum number of nodes
     */
    function _createPagination (node, max) {
        var pagination,
            type;

        if (node instanceof CrossNode || node.id === _layout.getRootNode().id) {
            type = 'nodes';
        } else {
            type = 'edges';
        }

        pagination = new Pagination(node, _layout, max, type, _options);
        node.setPagination(pagination);
        _layout.put(pagination, node.id);
    }
}
module.exports = LayoutPaginationManager;

},{"./graphElements":8,"./pagination":17}],14:[function(require,module,exports){
'use strict';

var CrossNode = require('./graphElements').CrossNode;

// They are used when we need  to locate nodes on the graph
var defaultOptions = {
    COL_OFFSET: 100,        // It needed to calculate distance between columns in the graph
    ROW_OFFSET: 30,        // It needed to calculate distance between rows in the graph
    CROSS_NODE_OFFSET: 30, // It defines offset of the cross node relative to the next column position
    ELEMENT_WIDTH: 130
};

/**
 * LayoutPositionManager.
 * Manage position of nodes.
 *
 * Constructor parameters:
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      getVerticalBranchOffsetRelativeToNode(tree: Array, middleNode: Node): number
 *      calculateTree(rootNodes: Array, columnPosition: number, direction: boolean): void
 *      translateBrunch(rootNodes: node, xOffset: number, yOffset: number): void
 */
function LayoutPositionManager (_options) {
    var self = this;

    var COL_OFFSET = (_options && _options.COL_OFFSET != undefined ? _options.COL_OFFSET : defaultOptions.COL_OFFSET);
    var ROW_OFFSET = (_options && _options.ROW_OFFSET != undefined ? _options.ROW_OFFSET : defaultOptions.ROW_OFFSET);
    var CROSS_NODE_OFFSET = (_options && _options.CROSS_NODE_OFFSET != undefined ? _options.CROSS_NODE_OFFSET : defaultOptions.CROSS_NODE_OFFSET);

    /**
     * Takes given node as a root and places
     * all children around the root according to our layout.
     * @param {Node} rootNode - root node or node which has custom position
     * @return nothing;
     */
    self.calculateLayoutForNode = function (rootNode) {
        var pos = rootNode.position();
        var trees = _getLeftRightTrees(rootNode);

        var col_offset = (rootNode instanceof CrossNode ? CROSS_NODE_OFFSET : COL_OFFSET);
        var columns = { 0: (rootNode instanceof CrossNode ? [] : [rootNode]) };
        var columnsR = _calculateTree(trees.rightTree, pos.x + rootNode.getSize().width + col_offset, true);
        var columnsL = _calculateTree(trees.leftTree, pos.x - col_offset, false);

        columnsR.forEach(function (column, index) {
            columns[index + 1] = column;
        });
        columnsL.forEach(function (column, index) {
            columns[-(index + 1)] = column;
        });

        var leftBrunchTopOffset = _getVerticalBranchOffsetRelativeToNode(trees.leftTree, rootNode);
        var rightBrunchTopOffset = _getVerticalBranchOffsetRelativeToNode(trees.rightTree, rootNode);

        self.translateBrunch(trees.leftTree, 0, leftBrunchTopOffset);
        self.translateBrunch(trees.rightTree, 0, rightBrunchTopOffset);

        _calculateReverseBranchesOfTree(rootNode, columns);

        var newPos = rootNode.position();
        rootNode.position(pos.x, pos.y);

        self.translateBrunch(trees.leftTree, 0, pos.y - newPos.y);
        self.translateBrunch(trees.rightTree, 0, pos.y - newPos.y);

        _getAllCustomPositionNodesOfTheRootNode(rootNode).forEach(function (node) {
            self.calculateLayoutForNode(node);
        });
    };

    /**
     * Returns left and right trees of the root node
     * @return {Object} Result: { leftTree: Array, rightTree: Array };
     */
    function _getLeftRightTrees (rootNode) {
        var result = {leftTree: [], rightTree: []};
        var nodes = rootNode.getVisibleChildren();
        nodes.forEach(function (node) {
            if (node.nodePlacement()) {
                result.leftTree.push(node);
            } else {
                result.rightTree.push(node);
            }
        });
        return result;
    }

    /**
     * It pushes reverse nodes into the layout after the main part of the algorithm was done
     * @param {Node} rootNode - current node (on this loop of the recursion)
     * @param { [key: string]: Array of Node } columns - map (deep -> column), which contains columns of the nodes
     *  deep === 0 -> rootNode;
     *  deep < 0 -> left tree
     *  deep > 0 -> right tree
     * @param deep - number of current column from map
     */
    function _calculateReverseBranchesOfTree (rootNode, columns, deep) {
        if (!rootNode) return;
        if (deep === undefined) deep = 0;

        var nodeDirection = _getDirectionForReverseNode(rootNode);
        var children = rootNode.getVisibleChildren();
        var hasUnnormalDirection = (nodeDirection && rootNode.nodePlacement()) || (!nodeDirection && !rootNode.nodePlacement());
        var isntRootNode = !rootNode.isRootNode() &&
                                !rootNode.get('customPosition') &&

                                !rootNode.getPrevNode().isRootNode() &&
                                !rootNode.getPrevNode().get('customPosition') &&

                                !rootNode.getParent().isRootNode() &&
                                !rootNode.getParent().get('customPosition');
                                
        var calculateAfterChildren = false;

        if (isntRootNode && (hasUnnormalDirection || !columns[deep] || columns[deep].indexOf(rootNode) === -1)) {
            if(!(rootNode instanceof CrossNode)) {
                _pushNodeInTheColumn (columns, deep, rootNode);
            } else {
                calculateAfterChildren = true;
            }
        }

        children.forEach(function (node) {
            if (!node.get('customPosition')) {
                var nextDeep = (node.nodePlacement() ? deep - 1 : deep + 1);
                _calculateReverseBranchesOfTree(
                    node,
                    columns,
                    (rootNode instanceof CrossNode &&  !rootNode.isRootNode() && !rootNode.get('customPosition') ? deep : nextDeep)
                );
            }
        });

        if (calculateAfterChildren) {
            rootNode.alignRelativeToChildren();
        }
    }

    /**
     * It pushes the given node into the given column, and translate the overlayed nodes
     * @param { [key: string]: Array of Node } columns - map (deep -> column), which contains columns of the nodes
     *  deep === 0 -> rootNode;
     *  deep < 0 -> left tree
     *  deep > 0 -> right tree
     * @param deep - number of current column from map
     * @param targetNode - current node (on this loop of the recursion)
     *  or to the first node with custom position
     */
    function _pushNodeInTheColumn (columns, deep, targetNode) {
        if (!columns) return;
        if (!columns[deep]) columns[deep] = [];
        var column =columns[deep];

        var parent = targetNode.getParent();
        var parentPos = parent.position();
        var index = _getPlaceInColumn(column, parent);
        var baseElement = column[index];
        if (baseElement) {
            var baseElementPosition = baseElement.position();
            var toMoveDown = [];
            var toMoveUp = [];
            var before = _afterOrBefore(baseElementPosition, parent, column);

            column.forEach(function (node, i) {
                if (i > index) {
                    toMoveDown.push(node);
                }
                if (i < index) {
                    toMoveUp.push(node); 
                }
            });

            column.splice((before ? index : index + 1), 0, targetNode);
            targetNode.position(baseElementPosition.x, parentPos.y);
            if (
                (before && parentPos.y >= baseElementPosition.y || !before && parentPos.y <= baseElementPosition.y) ||
                (_hitTestWithNeigbours(targetNode, column))
            ) {
                var targetPos = {
                    x: baseElementPosition.x,
                    y: baseElementPosition.y + (!before ? ROW_OFFSET + targetNode.getSize().height : -(ROW_OFFSET + targetNode.getSize().height))
                };
                targetNode.position(targetPos.x, targetPos.y);
                if (targetPos.y <= parentPos.y && toMoveUp.length > 0 && _hitTest(toMoveUp[toMoveUp.length - 1], targetNode)) {
                    for (var i = toMoveUp.length - 1; i >= 0; i--) {
                        var node = toMoveUp[i];
                        var prev = toMoveUp[i + 1];

                        if (i === toMoveUp.length - 1 && _hitTest (node, targetNode) || _hitTest (node, prev)) {
                            var offset = ((prev || targetNode).position().y - ROW_OFFSET - node.getSize().height) - node.position().y;
                            _translateReverseNode(node, 0, offset);
                        }
                    }
                } else if (targetPos.y > parentPos.y && toMoveDown.length > 0 && _hitTest(toMoveDown[0], targetNode)) {
                    toMoveDown.forEach(function (node, i, arr) {
                        var prev = arr[i - 1];

                        if (i===0 && _hitTest (node, targetNode) || _hitTest (node, prev)) {
                            var offset = ((prev || targetNode).position().y +  ROW_OFFSET + targetNode.getSize().height) - node.position().y;
                            _translateReverseNode(node, 0, offset);
                        }
                    });
                }
            }
            
        } else {
            var nextColumnPosition = 
                parentPos.x + (targetNode.nodePlacement() ? -(targetNode.getSize().width + COL_OFFSET) :
                (targetNode.getSize().width + COL_OFFSET));
            var nextColumnPositionForNode = targetNode instanceof CrossNode ? parentPos.x : nextColumnPosition;
            
            targetNode.position(nextColumnPositionForNode, parentPos.y);
            targetNode.pushedAfterLayout = true;
            column.push(targetNode);
        }
        return column;
    }

    /**
     * It's kind of shell for the function "getDirection" 
     *  but it's not takes (root nodes / custom positioned), but it takes
     *  the first children of this node, and return orientation
     * @param targetNode - current node (on this loop of the recursion)
     * @returns {boolean} orientation
     */
    function _getDirectionForReverseNode (node) {
        var parent = node.getPrevNode();
        if ((!parent || parent.isRootNode() || parent.get('customPosition')) && (!node.nodePlacement())) {
            return node.getDirectionRelativeToNode(parent);
        } else {
            return _getDirectionForReverseNode(parent);
        }
    }

    /**
     * Answer for question: "Push the new node after or before the existed node?"
     * @param {Point} baseElementPos - existed node
     * @param {Node} parent - parent node 
     * @param {Array of Node} column
     * @returns {boolean} before -> true | afrer -> false
     */
    function _afterOrBefore (baseElementPos, parent, column) {
        var parentPos = parent.position();
        var before = parentPos.y - baseElementPos.y;
        var after = baseElementPos.y - parentPos.y;

        parent.getVisibleChildren().forEach(function (curNode) {
            var direction = _getDirectionForReverseNode(curNode);
            if (column.indexOf(curNode) !== -1 && (direction && curNode.nodePlacement() || !(direction || curNode.nodePlacement()))) {
                var curNodePose = curNode.position();
                if (curNodePose.y > baseElementPos.y) {
                    after += (curNodePose.y - baseElementPos.y);
                } else if (curNodePose.y < baseElementPos.y) {
                    before += (baseElementPos.y - curNodePose.y);
                }
            }
        });
        return before < after;
    }

    /**
     * Selects the suitable place in the column for the new node.
     * @param {Array of Node} column
     * @param {Node} parent - parent Node
     * @returns {number} index - index in the column array
     */
    function _getPlaceInColumn (column, parent) {
        if (column.length === 0) return -1;
        var parentPos = parent.position();
        var index = 0;
        var curVal = column[index].position.y >= parentPos.y;
        for (var i = 0; i < column.length ; i++) {
            var pos = column[i].position();
            var newVal = pos.y >= parentPos.y;
            if (newVal !== curVal) {
                index = i;
                break;
            } else if (pos.y <= parentPos.y) index = i;
            curVal = newVal;
        }
        if (index === column.length - 1 && column[column.length - 1].position.y <= parentPos.y) index = i;
        return index;
    }

    /**
     * Translates node, and align the root crossNode if exist.
     * @param {Node} targetNode - translated Node
     * @param {number} xOffset - Column offset (on x-axis)
     * @param {number} yOffset - Row offset (on y-axis)
     */
    function _translateReverseNode (targetNode, xOffset, yOffset) {
        targetNode.position(
            targetNode.position().x + xOffset,
            targetNode.position().y + yOffset
        );
        var prevNode = targetNode.getPrevNode();
        if (prevNode && prevNode instanceof CrossNode) prevNode.alignRelativeToChildren();
    }

    /**
     * Calculate positions of all elements of the tree.
     * @param {Array} rootNodes - list of root nodes
     * @param {number} columnPosition - first column offset on x-axis
     * @param {boolean} direction - Direction: false => left; true => right
     * @returns {Array of Array of Nodes} Elements by columns
     */
    function _calculateTree (rootNodes, columnPosition, direction) {
        var columns = [];
        if (!rootNodes || rootNodes.length == 0) return columns;

        var filteredRootNodes = rootNodes.filter(function (node) {
            return !node.get('customPosition');
        });
        
        filteredRootNodes.forEach(function (node) {
            _calculateBranch(
                node,
                columnPosition,
                direction,
                0,
                columns
            );
        });

        return columns;
    }

    /**
     * Translate all elements of the branch.
     * @param {Array} rootNodes - Root nodes of the branch
     * @param {number} xOffset - Column offset (on x-axis)
     * @param {number} yOffset - Row offset (on y-axis)
     */
    self.translateBrunch = function (rootNodes, xOffset, yOffset) {
        if (!rootNodes || rootNodes.length == 0) return;
        var nodes = rootNodes.filter(function (node) {
            return !node.get('customPosition');
        });

        nodes.forEach(function (node) {
            self.translateBrunch(node.getVisibleChildren(), xOffset, yOffset);
            node.position(
                node.position().x + xOffset,
                node.position().y + yOffset
            );
        });
    };

    /**
     * Returns vertical offset of the tree relative to the root node
     * @param {Array} tree - list of root nodes
     * @param {Node} middleNode - We do align relative to this node
     * @return {number} Vertical branch offset
     */
    function _getVerticalBranchOffsetRelativeToNode (tree, middleNode) {
        if (tree && tree.length > 0) {
            tree = tree.filter(function (node) {
                return !node.get('customPosition');
            });
            if (tree.length == 0) return 0;
        } else {
            return 0;
        }

        var firstChield = tree[0];
        if (firstChield instanceof CrossNode) {
            var firstNodeChildren = firstChield.getVisibleChildren(true).filter(function (node) {
                return !node.get('customPosition');
            });

            for (var i = 0; i < firstNodeChildren.length; i++) {
                if (firstNodeChildren[i] && !firstNodeChildren[i].get('hidden')) {
                    firstChield = firstNodeChildren[i];
                    break;
                }
            }
        }

        var lastChield = tree[tree.length - 1];
        if (lastChield instanceof CrossNode) {
            var lastNodeChildren = lastChield.getVisibleChildren(true).filter(function (node) {
                return !node.get('customPosition');
            });

            for (i = lastNodeChildren.length - 1; i >= 0; i--) {
                if (lastNodeChildren[i] && !lastNodeChildren[i].get('hidden')) {
                    lastChield = lastNodeChildren[i];
                    break;
                }
            }
        }

        if (!lastChield || !firstChield) return 0;
        var columnCenter = (lastChield.position().y + lastChield.getSize().height + firstChield.position().y) / 2;
        return middleNode.position().y + middleNode.getSize().height / 2 - columnCenter;
    }

    /**
     * Calculate positions of all elements of branch.
     * @param {Node} rootNode - Root node of the branch
     * @param {number} columnPosition - Column offset (on x-axis)
     * @param {number} rowPosition - Row offset (on y-axis)
     * @param {boolean} direction - Direction: false => left; true => right
     * @param {number} deep - column number
     * @param {Array} columns - columns list
     * @returns {number} Height of the column, which include height of the child columns
     */
    function _calculateBranch (rootNode, columnPosition, direction, deep, columns) {
        var children = rootNode.getVisibleChildren();
        var filteredChildren = children.filter(function (node) {
            return !node.get('customPosition') && (direction && !node.nodePlacement() || node.nodePlacement() && !direction);
        }); // filter all nodes with custom position

        var columnWidth = rootNode.getSize().width; // set starting width for the column for case when there are no children

        // calculate next column position (if one of the children is cross node then next column position is current column position)
        var nextColumnPosition = columnPosition + (direction ? (columnWidth + COL_OFFSET) : -(columnWidth + COL_OFFSET));

        // Enter the recursion by nodes without custome position and calculation height of child column
        filteredChildren.forEach(function (node) {
            // if there is cross node then hist children placing in same column with parent, but parent (crossNode) has offset
            var nextColumnPositionForNode = rootNode instanceof CrossNode ? columnPosition : nextColumnPosition;
            _calculateBranch(
                node,
                nextColumnPositionForNode,
                direction,
                (rootNode instanceof CrossNode ? deep : deep + 1), // if node is cross node then we don't increase column index
                columns
            );
        });

        // Set position of the current node
        _setPositionOfTheNode(
            filteredChildren,
            rootNode,
            columnPosition,
            direction,
            deep,
            columns
        );
    }

    /**
     * Defines node position and return recursion result-data for function _calculateBranch.
     * @param {Array} filteredChildren - sorted, paginated, filtered children list
     * @param {Node} rootNode - Root node of the branch
     * @param {number} columnPosition - Column offset (on x-axis)
     * @param {number} rowPosition - Row offset (on y-axis)
     * @param {boolean} direction - Direction: false => left; true => right
     * @param {number} deep - column number
     * @param {Array} columns - columns list
     * @param {number} childrensColumnHeight - Height of the child column
     * @param {boolean} ableToCondensing - true if node can be raised to the nodes which located in this column above current node
     * @returns {number} Height of the column, which include height of the child columns
     */
    function _setPositionOfTheNode (filteredChildren,
                                   rootNode,
                                   columnPosition,
                                   direction,
                                   deep,
                                   columns) {
        if (!columns[deep]) columns[deep] = []; // if there aren't elements in this column create array
        var column = columns[deep];
        var isCrossNode = rootNode instanceof CrossNode;

        var xPosition = columnPosition - (!direction ? rootNode.getSize().width : 0);
        xPosition = (isCrossNode ?
            (xPosition + (direction ?
                -CROSS_NODE_OFFSET :
                +CROSS_NODE_OFFSET)) :
            xPosition);

        var yPosition = 0;

        var yPosRealtiveToChildren = 0;
        if (filteredChildren.length > 0) {
            var lastChield = filteredChildren[filteredChildren.length - 1];
            var firstChield = filteredChildren[0];
            yPosRealtiveToChildren = (
                lastChield.position().y
                + firstChield.getSize().height
                + firstChield.position().y
                - rootNode.getSize().height
            ) / 2;
        }

        var yPosMin = 0;
        if (column.length > 0) {
            var bottomNode = column[column.length - 1];
            yPosMin = bottomNode.position().y + bottomNode.getSize().height + ROW_OFFSET;
        }

        if (isCrossNode || yPosMin <= yPosRealtiveToChildren) {
            yPosition = yPosRealtiveToChildren;
        } else {
            yPosition = yPosMin;
            if (!isCrossNode) {
                self.translateBrunch(filteredChildren, 0, yPosMin - yPosRealtiveToChildren);
            }
        }
        
        rootNode.position(xPosition, yPosition);

        if (!isCrossNode) {
            column.push(rootNode);
        } 
    }

    function _getAllCustomPositionNodesOfTheRootNode (rootNode) {
        var children = rootNode.getVisibleChildren();
        var customChildren = children.filter(function (node) {
            return node.get('customPosition');
        });
        children.forEach(function (n) {
            customChildren = customChildren.concat(_getAllCustomPositionNodesOfTheRootNode(n));
        });
        return customChildren;
    }

    /**
     * Checks whether the node is overlapped with some of the neigbours in the column.
     * @param {Node} node
     * @param {Array of Node} column
     * @returns {boolean}
     */
    function _hitTestWithNeigbours (node, column) {
        var index = column.indexOf(node);
        if (index === -1) return false;
        return _hitTest (node, column[index - 1]) || _hitTest (node, column[index + 1]);
    }

    /**
     * Checks whether the node number one and the number two are overlapped.
     * @param {Node} node1
     * @param {Node} node2
     * @returns {boolean}
     */
    function _hitTest (node1, node2) {
        if (!node1 || !node2) return false;
        var bBox = null;
        var testedNode = null;

        if (node1.getSize().height > node2.getSize().height) {
            bBox = node1.getBBox();
            testedNode = node2;
        } else {
            bBox = node2.getBBox();
            testedNode = node1;
        }
        var p = testedNode.position();
        var size = testedNode.getSize();
        var xCenter = p.x + size.width / 2;
        return (
            bBox.containsPoint({x: xCenter, y: p.y}) ||
            bBox.containsPoint({x: xCenter, y: p.y + size.height}) ||
            bBox.containsPoint({x: xCenter, y: p.y - ROW_OFFSET}) ||
            bBox.containsPoint({x: xCenter, y: p.y + ROW_OFFSET})
        );
    }
}
module.exports = LayoutPositionManager;

},{"./graphElements":8}],15:[function(require,module,exports){
'use strict';

var NeighborGram = require('./neighborGram');
var DataProvider = require('./dataProvider');

var InfoPanel = require('./htmlUI/infoPanel');
var OptionsPanel = require('./htmlUI/optionsPanel');
var DefaultUI = require('./htmlUI/defaultUI');

module.exports = {
    getDefaultProperties: function () {
        return {
            DEFAULT_PAGE_SIZE:      5,   // It's for pagination
            COLOR_CLASS_COUNT:      10,
            COL_OFFSET:             100, // It used to calculate distance between columns in the graph
            ROW_OFFSET:             30,  // It used to calculate distance between rows in the graph
            CROSS_NODE_OFFSET:      30,  // It define offset of the cross node relative to the next column position
            ELEMENT_WIDTH:          130,
            ELEMENT_HEIGHT:         30,
            TRANSITIVE_EXPANSION_LIMIT_STEP: 10, // It says how much nodes will be expanded transitively
                                                 // before the question 'Do you want to continue?'
            FULL_NODE_LABELS: false,             // Tells whether or not should we expand node labels
            COLOR_CLASS_MAP: {
                'subClassOf': 'color-class-sub-class-of',
                'type': 'color-class-type'
            }
        };
    },

    create: function (el, dataProvider, focusNodeId, resourcePath, options) {
        return new NeighborGram(
            dataProvider, 
            {el: el}, // paper properties
            focusNodeId,
            resourcePath,
            options
        );
    },
    
    getDefaultDataProvider: function (serverUrl, base, viewClass) {
        return new DataProvider(serverUrl, base, viewClass);
    },

    uiUtils: {
        DefaultUI: DefaultUI,
        InfoPanel: InfoPanel,
        OptionsPanel: OptionsPanel,
    },
};

},{"./dataProvider":7,"./htmlUI/defaultUI":10,"./htmlUI/infoPanel":11,"./htmlUI/optionsPanel":12,"./neighborGram":16}],16:[function(require,module,exports){
'use strict';

var cloneDeep = require('lodash').cloneDeep;
var joint = require('rappid');
var TQGramUI = require('visualizations-library');
var GraphLayout = require('./graphLayout');
var StateStorage = require('./stateStorage');
var PopUpMenu = require('./popUpMenu');
// var ArrayBuffer = require('typedarray').ArrayBuffer;
// var Uint8Array = require('typedarray').Uint8Array;
var graphElements = require('./graphElements');
var saveAs = require('file-saverjs');

var Node = graphElements.Node;
var Edge = graphElements.Edge;
var CrossNode = graphElements.CrossNode;

/**
 * NeighborGram.
 * Contain graph layout and manage all data.
 *
 * Constructor parameters:
 *      dataProvider: DataProvider
 *      paperProperties: {jointjs graph properties}
 *      focusNodeId: string
 *      resourcePath: string
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          ELEMENT_WIDTH: number;
 *          ELEMENT_HEIGHT: number;
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      setFocusNode(focusNodeId: string): void
 *      onNodeSelected(callback: function): void
 *      onNodeFocused(callback: function): void
 *      clean(): void
 *      getNodes(): Node[]
 *      getEdges(): Edge[]
 *      getStatesHistory(): {
 *          states: [],
 *          currentIndex: number,
 *      }
 *      refreshLayout(): void
 *      center(x: number, y: number, opt: opt): void
 *      zoom(scale: number, opt: opt): void
 *      undoState(): void - returns to state with previous focusNode
 *      redoState(): boid - returns to state with next(previous before undo) focusNode
 */
function NeighborGram (dataProvider, paperProperties, focusNodeId, resourcePath, options) {
    var self = this;

    /**
     * Private filds
     */
    var _paper = null;
    var _options = cloneDeep(options);
    var _layout = null;
    var _onNodeFocusedCallBack = null;
    var _onStateChangedCallBack = null;
    var _graph = null;
    var _paperScroller = null;
    var _el = null;
    var _stateStorage = null;
    var _uiLayer = null;
    var _popUpMenu = null;
    var _asynkOperation = false;
    var _dataCache = {};
    var _transitiveCore = new TransitiveCore(self);
    var _fullNodeLabels = _options.FULL_NODE_LABELS;
    var _progressScreen = null;


    /**
     * Private function which used as constructor
     * @param  {DataProvider} dataProvider - Object which provide data for graph
     * @param  {Object} paperProperties - Properties for joint.dia.Paper
     * @param  {string} focusNodeId - Id which used to set focus node
     * @param  {string} resourcePath - Path to icon resources, used for runtime URLs
     * @param  {Object} options - options for the application
     */
    function _initialize (dataProvider, paperProperties, focusNodeId, resourcePath, options) {
        self.resourcePath = resourcePath;
        self.dataProvider = dataProvider;
        _graph = paperProperties.graph ? paperProperties.graph : new joint.dia.Graph();

        var defaultProp = {
            el: 'graphPlace',
            model: _graph,
            gridSize: 1,
            width: '5000',
            height: '5000',
            async: true
        };
        
        var properties = _extendProperties(defaultProp, paperProperties);
        var elId = properties.el;
        properties.el = undefined;
        _paper = new joint.dia.Paper(properties);

        _paperScroller = new joint.ui.PaperScroller({
            paper: _paper
        });

        var commandManager = new joint.dia.CommandManager({graph: _graph});
        var validator = new joint.dia.Validator({commandManager: commandManager});
        validator.validate('change:position', _validatePosition);
        validator.on('invalid', function (err) {
            console.log(err);
            _layout.getNodes().forEach(function (node) {
                node.badPosition(false);
            });
        });

        _paper.on('cell:mousewheel', function (cell, evt, x, y, delta) {
            onWheelScroll (evt, x, y, delta);
        });
        _paper.on('blank:mousewheel', function (evt, x, y, delta) {
            onWheelScroll (evt, x, y, delta);
        });
        
        var root = document.getElementById(elId);
        root.innerHTML = '';
        _el = document.createElement('DIV');
        root.appendChild(_el);

        _el.className = 'tq-ng-root';
        _el.appendChild(_paperScroller.render().el);
        _configuratePaperListeners();

        _progressScreen = new TQGramUI.ProgressScreen({
            baseElement: _el,
        });
    

        _layout = new GraphLayout(_graph, _paper, _paperScroller, options);
        _stateStorage = new StateStorage(_layout, options);

        _onNodeFocusedCallBack = [];

        _onStateChangedCallBack = [];

        if (focusNodeId) self.setFocusNode(focusNodeId);

        function onWheelScroll (evt, x, y, delta) {
            if (evt.ctrlKey) {
                if (delta > 0) {
                    self.zoom(0.2, { max: 4 });
                } else {
                    self.zoom(-0.2, { min: 0.2 });
                }
                if (_popUpMenu) _popUpMenu.refresh();
                evt.preventDefault();
            }
        }

        _uiLayer = _createUILayer();
    }

    /**
     * Function used to clean graph (Remove all nodes and edges from layout).
     */
    self.clean = function () {
        _layout.cleanLayout();
    };

    self.fullNodeLabels = function (value) {
        if (value !== undefined) {
            _fullNodeLabels = value;
            var nodes = _layout.getNodes();
            nodes.forEach(function (node) {
                node.set('fullLabel', _fullNodeLabels);
            });
            _layout.recalculateLayout();
        }
        return _fullNodeLabels;
    };

    /**
     * Function do request data through data provider and set new node as focused.
     * @param  {string} focusNodeId - Id of focus node
     */
    self.setFocusNode = function (focusNodeId) {
        _loadingIndication ('fetching');
        _asynkOperation = true;
        _requestData(focusNodeId,
            function (result) {
                _asynkOperation = false;
                _loadingIndication ('rendering');
                requestAnimationFrame(function () { // it's necessary to make able js change loading title.
                    var index = result.nodes.map(function (node) {
                        return node.id;
                    }).indexOf(focusNodeId);
                    if (index != -1) {
                        if (_layout.getRootNode()) _stateStorage.pushState();

                        self.clean();
                        var centralNode = _setCentralNode(result.nodes[index]);
                        result.nodes.splice(index, 1);

                        _expandNode(centralNode.id, result);
                        self.refreshLayout();
                        _onNodeFocusedCallBack.forEach(function (callBack) {
                            callBack(centralNode);
                        });
                        _loadingIndication ('completed');
                    } else {
                        _loadingIndication ('completed');
                    }
                });
            },
            function (message) {
                _loadingIndication ('error');
                _asynkOperation = false;
                _loadingIndication ('completed');
                new joint.ui.Dialog({
                    type: 'alert',
                    width: 300,
                    title: 'Alert',
                    content: message
                }).open();
            });
    };

    /**
     * Function which needed to set handler on 'Node selected' event.
     * @param  {function} callback - Handler
     */
    self.onNodeSelected = function (callback) {
        _paper.on('cell:pointerdown', function (cell) {
            if (cell && cell.model instanceof Node) {
                callback(cell.model);
            } else {
                callback(null);
            }
        });
        _paper.on('blank:pointerdown', function () {
            callback(null);
        });
    };

    /**
     * Function which needed to set handler on 'Node focused' event.
     * @param  {function} callback - Handler
     */
    self.onNodeFocused = function (callback) {
        _onNodeFocusedCallBack.push(callback);
    };

    /**
     * Function which needed to set handler on 'State changed' event.
     * @param  {function} callback - Handler
     */
    self.onStateChanged = function (callback) {
        _onStateChangedCallBack.push(callback);
    };

    /**
     * Return all nodes of the graph.
     * @returns {Array} Nodes of the graph
     */
    self.getNodes = function () {
        return _layout.getNodes();
    };

    /**
     * Return all edges of the graph.
     * @returns {Array} Edges of the graph
     */
    self.getEdges = function () {
        return _layout.getEdges();
    };

    /**
     * Recalculates the layout
     */
    self.refreshLayout = function () {
        _layout.recalculateLayout();
        self.center();
    };

    /**
     * Centers paper
     * @param {number} x - coordinate of the center on x axis
     * @param {number} y - coordinate of the center on y axis
     * @param {opt} opt - (optional) options of paperScroller
     */
    self.center = function (x, y, opt) {
        if (x && y) _paperScroller.center(x, y, opt);
        else {
            var root = _layout.getRootNode();
            _paperScroller.center(
                root.position().x + root.getSize().width / 2,
                root.position().y + root.getSize().height / 2,
                opt
            );
        }
    };

    /**
     * It centers paper
     * @param {number} scale - offset values of scale
     * @param {opt} opt - (optional) options of paperScroller zooming
     */
    self.zoom = function (scale, opt) {
        if (!scale) _paperScroller.zoomToFit(opt);
        else _paperScroller.zoom(scale, opt);
        _layout.recalculateLayout();
        if (_popUpMenu) _popUpMenu.refresh();
    };

    /**
     * Set previous focuseNode as cur focusNode
     */
    self.undoState = function () {
        var state = _stateStorage.undoState();
        if (state) {
            _layout.loadState(state);
            _layout.recalculateLayout();
            _onStateChangedCallBack.forEach(function (callBack) {
                callBack(state);
            });
        }
    };

    /**
     * Set previous (before self.undoState) focuseNode as cur focusNode
     */
    self.redoState = function () {
        var state = _stateStorage.redoState();
        if (state) {
            _layout.loadState(state);
            _layout.recalculateLayout();
            _onStateChangedCallBack.forEach(function (callBack) {
                callBack(state);
            });
        }
    };

    /**
     * Return list of focusNodes and current index.
     * @returns {
     *  states: [],
     *  currentIndex: number,
     * }
     */
    self.getStatesHistory = function () {
        return _stateStorage.getHistory();
    };

    /**
     * Exports graph to png or svg file
     * @param {
     *  name?: string - file name
     *  type?: string - (png/svg)
     * } options
    */
    self.export = function (options) {
        if (!options) options = {};
        var fileName = options.name || 'NeighborGram_snapshot_' + date2String(new Date());

        if (options.type === 'png') {
            _paper.toPNG(function (image) {
                saveData(image, fileName, 'png');
            });
        } else {
            _paper.toSVG(function (svgString) {
                saveData(svgString, fileName, 'svg');
            },{
                convertImagesToDataUris: true,
                area: _paper.getContentBBox(),
                preserveDimensions: true,
            });
        }

        function saveData (data, fileName, type) {            
            var blob;
            if (type === 'svg') {
                blob = new Blob([data], { type: type });
            } else if (type === 'png') {
                blob = png2Blob (data);
            }
            saveAs(blob, fileName + '.' + type);
        }
    };

    self.setSelectedNode = _setSelectedNode;

    //Private functions
    //=========================================================
    //=========================================================

    function date2String (date) {
        return padStr(date.getFullYear()) + '_' +
                padStr(1 + date.getMonth()) + '_' +
                padStr(date.getDate()) + '_' +
                padStr(date.getHours()) + '_' +
                padStr(date.getMinutes()) + '_' +
                padStr(date.getSeconds());

        function padStr (i) {
            return (i < 10) ? '0' + i : '' + i;
        }
    }

    function png2Blob (dataURI) {
        // convert base64 to raw binary data held in a string
        // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
        var byteString = atob(dataURI.split(',')[1]);

        // write the bytes of the string to an ArrayBuffer
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        // write the ArrayBuffer to a blob, and you're done
        var bb = new Blob([ab], { type: 'image/png' });
        return bb;
    }

    // states: fetching, rendering, completed
    function _loadingIndication (state) {
        if (state === 'fetching') {
            _progressScreen.setState('active', 'Fetching data');
        } else if (state === 'rendering') {
            _progressScreen.setState('active', 'Rendering graph');
        } else if (state === 'completed') {
            _progressScreen.setState('completed');
        } else if (state === 'error') {
            _progressScreen.setState('error', 'Error has occurred!');
        }
    }

    function _createUILayer () {
        var uiLayer = document.createElement('DIV');
        uiLayer.className = 'ng-ui';
        _el.querySelector('.paper.joint-theme-default').appendChild(uiLayer);
        return uiLayer;
    }

    /**
     * Validates position of the node q.v. joint.dia.Validator
     */
    function _validatePosition (err, command, next) {
        var cell = command.data.attributes || _graph.getCell(command.data.id);
        if (!_layout.blockValidation && cell && !_checkPosition(cell)) {
            return next('Another cell in the way!');
        } else
            return next();
    }

    /**
     * Checks position of the node and change color-class if needed
     * @param {Node} node - checked node
     * @param {boolean} recursively - flag if we needed check recursively
     */
    function _checkPosition (node, recursively) {
        if (!(node instanceof Node)) return true;

        var hitTest = function (node1, node2) {
            if (!node1 || !node2 || node1 instanceof CrossNode || node2 instanceof CrossNode) return false;
            var bBox = null;
            var testedNode = null;

            if (node1.getSize().height > node2.getSize().height) {
                bBox = node1.getBBox();
                testedNode = node2;
            } else {
                bBox = node2.getBBox();
                testedNode = node1;
            }
            var p = testedNode.position();
            var size = testedNode.getSize();
            return (bBox.containsPoint({x: p.x, y: p.y}) ||
            bBox.containsPoint({x: p.x + size.width, y: p.y}) ||
            bBox.containsPoint({x: p.x, y: p.y + size.height}) ||
            bBox.containsPoint({x: p.x + size.width, y: p.y + size.height}));
        };

        var result = _graph.get('cells').filter(function (cell) {
            if ((cell instanceof Node || cell instanceof CrossNode) &&
                cell.id !== node.id &&
                hitTest(cell, node)) {
                return true;
            } else {
                return false;
            }
        }).length == 0;

        if (recursively) {
            node.getVisibleChildren().forEach(function (child) {
                result = _checkPosition(child, recursively) && result;
            });
        }
        node.badPosition(!result);
        return result;
    }

    /**
     * Converts node from server into simple node and sets it as root into layout.
     * @param  {Object} serverNode - Server node
     */
    function _setCentralNode (serverNode) {
        var centralNode = _createNode(serverNode);
        _layout.setRootNode(centralNode);
        // _paperScroller.center(_layout.getRootNode().position());
        return centralNode;
    }

    /**
     * Simplified set up paper. Enrich old properties by new one.
     * @param {Object} oldProp - Old properties
     * @param {Object} newProp - New properties
     * @returns {Object} Exstended properties
     */
    function _extendProperties (oldProp, newProp) {
        var extendedObject = {};
        if (oldProp) {
            Object.keys(oldProp).forEach(function (p) {
                extendedObject[p] = oldProp[p];
            });
        }
        if (newProp) {
            Object.keys(newProp).forEach(function (p) {
                extendedObject[p] = newProp[p];
            });
        }
        return extendedObject;
    }

    /**
     * Highlights target element
     */
    function _setSelectedNode (cell) {
        self.getNodes().forEach(function (node) {
            node.removeHighlighting();
        });
        if (cell) {
            var node;
            if (cell.model && cell.model.addHighlighting) {
                node = cell.model;
            } else if (cell.addHighlighting) {
                node = cell;
            }
            if (!node.get('hidden')) {
                node.addHighlighting();
            } else {
                var prevNode = node.getPrevNode();

                if (prevNode.pagination) {
                    prevNode.getChildren(true).forEach(function (child, index) {
                        if (child === node) {
                            prevNode.pagination.focusOn(index);
                        }
                    });
                }
                node.addHighlighting();
            }
        }
    }

    /**
     * Sets event handlers
     */
    function _configuratePaperListeners () {
        var lastPosition = null;
        var THRESHOLD = 15;
        _paper.on('cell:pointerdown', function (cell) {
            if (cell && cell.model instanceof Node) {
                if (!lastPosition) lastPosition = cell.model.position();

                _setSelectedNode(cell);
            }
        });

        _paper.on('cell:pointermove', function (cell) {
            if (cell && cell.model instanceof Node) {
                joint.ui.Halo.clear(_paper);
                if (Math.sqrt(
                        Math.pow((lastPosition.x - cell.model.position().x), 2) +
                        Math.pow((lastPosition.y - cell.model.position().y), 2)
                    ) < THRESHOLD && !cell.model.get('customPosition')
                ) return;

                if (!cell.model.get('customPosition')) {
                    cell.model.set('customPosition', true);
                    _layout.recalculateLayout();
                }
                _checkPosition(cell.model, true);
            }
        });

        _paper.on('cell:pointerdblclick', function (cell) {
            if (cell && cell.model instanceof Node) {
                cell.model.set('fullLabel', !cell.model.get('fullLabel'));
                _layout.recalculateLayout();
            }
        });

        _paper.on('cell:pointerup', function (cell) {
            if (cell && cell.model instanceof Node) {
                _configurateHalo(cell);
                lastPosition = null;

                _setLinkPaginationControlsInactive();
                _setLinkPaginationControlActive(cell.model);
            }
        });

        _paper.on('blank:pointerdown', _paperScroller.startPanning);
        _paper.on('blank:pointerdown', function () {
            _setSelectedNode(undefined);

            _setLinkPaginationControlsInactive();
        });
    }

    /**
     * Configurates halo for Node
     * @param {Object} cellView - View of node
     */
    function _configurateHalo (cellView) {
        if (_popUpMenu && _popUpMenu.target !== cellView.model) {
            _removePopUp();
        }

        var node = cellView.model;
        var halo = new joint.ui.Halo({
            graph: _graph,
            paper: _paper,
            cellView: cellView,
            className: 'halo' + (node.id === _layout.getRootNode().id ? ' halo-of-root-node' : '')
        });
        halo.removeHandles();

        if (node.get('customPosition')) {
            halo.addHandle({name: 'reset-node-position', position: 's'});
            halo.on('action:reset-node-position:pointerdown', function (evt) {
                evt.stopPropagation();
                _layout.doForBrunch(node, function (node) {
                    node.set('customPosition', false);
                });
                _layout.recalculateLayout();
            });
        }

        if (node.dataModel.typeId !== 'crossNode') {
            var configButtonClass = node.getDirection() ? 
                'expansion-config' + (node.configurationSet.modified ? '-modified' : '') :
                'expansion-config' + (node.configurationSet.modified ? '-modified' : '') + '-reverse';
            halo.addHandle({name: configButtonClass});
            halo.on('action:' + configButtonClass + ':pointerdown', function (evt) {
                evt.stopPropagation();
                _openConfigPopUp(cellView);
            });

            if (node.id !== _layout.getRootNode().id) {
                var setFocusNodeClass = node.getDirection() ? 'set-focus-node' : 'set-focus-node-reverse';
                halo.addHandle({
                    name: setFocusNodeClass,
                });
                halo.on('action:' + setFocusNodeClass + ':pointerdown', function (evt) {
                    if (_asynkOperation) return;
                    evt.stopPropagation();
                    self.setFocusNode(node.dataModel.typeId);
                });
            }

            var expandCollapseClass = node.getDirection() ? 'expand-collapse' : 'expand-collapse-reverse';

            halo.addHandle({
                name: (node.dataModel.canExpand ? expandCollapseClass : expandCollapseClass + ' disabled'),
                position: (!node.get('expanded') ? ' ng-expand': ' ng-collapse')
            });

            halo.on(
                'action:' + expandCollapseClass + ':pointerdown',
                function () {
                    if (node.dataModel.canExpand) {
                        _onExpandEvent(cellView.model);
                    }
                }
            );

            halo.listenTo(node, 'change:customPosition', function () {
                _configurateHalo(cellView);
            });
            halo.listenTo(node, 'change:expanded', function () {
                _configurateHalo(cellView);
            });
        }
        halo.render();
    }

    function _openConfigPopUp (cell) {
        if (cell && cell.model instanceof Node) {
            if (!_popUpMenu || !_popUpMenu.alive) {
                var isExpanded;
                var localPopUp = _popUpMenu = new PopUpMenu({
                    base: _uiLayer,
                    target: cell.model,
                    scroller: _paperScroller,
                    beforeApply: function () {
                        isExpanded = cell.model.get('expanded');
                        if (isExpanded) {
                            cell.model.set('expanded', false);
                            _layout.collapseNode(cell.model.id);
                        }
                    },
                    afterApply: function () {
                        _onExpandEvent(cell.model);
                        _configurateHalo(cell);
                    }
                });
                if (!cell.model.configurationSet.connections) {
                    _requestData(cell.model.typeId,
                        function (result) {
                            if (localPopUp === _popUpMenu) {
                                _popUpMenu.putData(result.edges || []);
                            }
                        },
                        function (message) {
                            new joint.ui.Dialog({
                                type: 'alert',
                                width: 300,
                                title: 'Alert',
                                content: message
                            }).open();
                        }
                    );
                }
            } else {
                _removePopUp();
            }
        }
    }

    /**
     * It's called on expand-event.
     * @param {Object} cell - View of Node
     * @param {string} orientation
     */
    function _onExpandEvent (node) {
        if (_asynkOperation) return;

        if (node.configurationSet && node.configurationSet.expandTransitively) {
            _transitiveCore.start(node);
        } else {
            if (node instanceof Node) {
                if (!node.get('expanded')) {
                    var loading = _addLoading(node);
                    node.set('expanded', true);
                    
                    _setLinkPaginationControlsInactive();
                    if (!_dataCache[node.id]) {
                        _asynkOperation = true;
                        _requestData(
                            node.typeId,
                            successCallback,
                            function (message) {
                                _asynkOperation = false;
                                new joint.ui.Dialog({
                                    type: 'alert',
                                    width: 300,
                                    title: 'Alert',
                                    content: message
                                }).open();
                                _removeLoading(loading);
                                _setLinkPaginationControlActive(node);
                            }
                        );
                    } else {
                        successCallback(_dataCache[node.id], {fromCache: true});
                    }
                } else {
                    node.set('expanded', false);
                    _collapseNode(node.id);
                }
            }
        }

        function successCallback (result, props) {
            _asynkOperation = false;
            _expandNode(node, result, props && props.fromCache);
            _layout.recalculateLayout();
            _removeLoading(loading);
            _setLinkPaginationControlActive(node);
        }
    }

    function _removePopUp () {
        _popUpMenu.remove();
        _popUpMenu = null;
    }

    /**
     * Request data throw data provider.
     * @param {String} typeId - Type id
     * @param {Function} successCallback - Handler
     * @param {Function} errorCallback - Handler
     */
    function _requestData (typeId, successCallback, errorCallback) {
        try {
            self.dataProvider.getGraphData(typeId, successCallback, errorCallback);
        } catch (error) {
            errorCallback.apply(self, [error]);
            if (typeof error === 'string') {
                console.error(error);
            } else {
                console.error(error.stack);
            }
        }
    }

    /**
     * It expands node by obtained data.
     * Binds new nodes and edges to source node.
     * @param {string | Node} node - Type id or Node
     * @param {Object} data - Data
     * @param {boolena} fromCache - equals true if data are passed from the cache
     */
    function _expandNode (node, data, fromCache) {
        var isNode = typeof node !== 'string';
        var nodeId = isNode ? node.id : node;

        var config = node.configurationSet;
        var mapForNodeFiltering = {};

        var preparedData;
        if (!fromCache) {
            preparedData = {
                nodes: data.nodes ? _prepareNodes(data.nodes) : [],
                edges: data.edges ? _prepareEdges(data.edges) : [],
            };
            _dataCache[nodeId] = preparedData;
        } else {
            preparedData = data;
        }

        // the data filtering
        var filteredData;
        if (typeof node !== 'string') {
            filteredData = {
                edges: preparedData.edges.filter(function (edge) {
                    var direction = node.dataModel.typeId === edge.dataModel.targetTypeId;
                    var verdict = (
                            config.filterType === 'ALL' ||
                            config.filterType === 'INCOMING' && direction ||
                            config.filterType === 'OUTGOING' && !direction
                        ) &&
                        (!config.filterKey || config.filterKey && edge.dataModel.label.toLowerCase().indexOf(config.filterKey.toLowerCase()) !== -1)
                        && (
                            direction && (
                                config.visibilityMap[edge.dataModel.typeId] === undefined || config.visibilityMap[edge.dataModel.typeId]
                            ) ||
                            !direction && (
                                config.visibilityMapReverse[edge.dataModel.typeId] === undefined || config.visibilityMapReverse[edge.dataModel.typeId]
                            )
                        );
                    
                    if (verdict) {
                        if (direction) {
                            mapForNodeFiltering[edge.dataModel.sourceTypeId] = true;
                        } else {
                            mapForNodeFiltering[edge.dataModel.targetTypeId] = true;
                        }
                    }

                    return verdict;
                }),
                nodes: preparedData.nodes.filter(function (node) {
                    return mapForNodeFiltering[node.dataModel.typeId];
                }),
            };
        } else {
            filteredData = preparedData;
        }

        if (filteredData.nodes.length > 0) {
            _layout.putAll(filteredData.nodes);
        }

        if (filteredData.edges.length > 0) {
            _layout.putAll(filteredData.edges, nodeId);
        }

        if (fromCache && isNode) {
            node.getChildren(true).forEach(function (children, index) {
                if (children.get('expanded')) {
                    if (children.pagination) {
                        node.pagination.focusOn(index);
                    }
                    _expandNode(children, _dataCache[children.id], fromCache);
                    _layout.recalculateLayout();
                }
            });
        }
        
    }

    /**
     * Collapses node and removes all children
     * of the Node from the layout.
     * Then recalculates layout.
     * @param {string} unbindFrom - Node id
     */
    function _collapseNode (unbindFrom) {
        _layout.collapseNode(unbindFrom);
        _layout.recalculateLayout();
    }

    /**
     * Converts list of server nodes
     * to List of graph nodes
     * @param {Array} serverNodes - List of server nodes
     * @returns {Array} Graph nodes
     */
    function _prepareNodes (serverNodes) {
        var nodes = [];

        serverNodes.forEach(function (node) {
            var newNode = _createNode(node);
            nodes.push(newNode);
        });
        return nodes;
    }

    /**
     * Converts list of server edges
     * to List of graph edges
     * @param {Array} serverEdge - List of server edges
     * @returns {Array} Graph edges
     */
    function _prepareEdges (serverEdge) {
        var edges = [];

        serverEdge.forEach(function (edge) {
            var newEdge = _createEdge(edge);
            edges.push(newEdge);
        });
        return edges;
    }

    /**
     * Converts server node
     * to graph node
     * @param {Object} node - Server node
     * @returns {Node} Graph node
     */
    function _createNode (node) {
        var newNode;

        newNode = new Node({
            typeId: node.id,
            label: node.label,
            canExpand: node.canExpand,
            fullNodeLabels: _fullNodeLabels,
        }, _options);
        return newNode;
    }

    /**
     * Converts server edge
     * to graph edge
     * @param {Object} edge - Server edge
     * @returns {Edge} Graph edge
     */
    function _createEdge (edge) {
        var newEdge = new Edge({
            typeId: edge.id,
            sourceTypeId: edge.source,
            targetTypeId: edge.target,
            label: edge.label,
            placement: edge.placement,
        });
        return newEdge;
    }

    /**
     * Sets all link pagination controls inactive
     */
    function _setLinkPaginationControlsInactive () {
        var nodes = self.getNodes();
        nodes.forEach(function (node) {
            var pagination = node.getPagination();
            if (pagination && pagination.getType() === 'edges') {
                pagination.setInactive();
            }
        });
    }

    /**
     * Sets link pagination control active
     * to graph edge
     * @param {Node} node
     */
    function _setLinkPaginationControlActive (node) {
        var pagination = node.getPagination();
        if (pagination && pagination.getType() === 'edges') {
            pagination.setActive();
        }
    }

    function _addLoading (node) {
        var loading = new joint.shapes.basic.Rect({
            size: {width: 55, height: 15},
            attrs: {
                rect: {'fill-opacity': 0, 'stroke-opacity': 0},
                text: {
                    text: 'Loading...',
                    'font-family': 'Arial, Helvetica, sans-serif',
                    'font-size': 11
                }
            },
            z: 100
        });

        var x = node.position().x,
            y = node.position().y;

        if (node.id === _layout.getRootNode().id) {
            x += (node.getSize().width - loading.get('size').width) / 2;
            y -= loading.get('size').height;
        } else {
            y += (node.getSize().height - loading.get('size').height) / 2;
            var direction = node.getDirection();

            if (direction) {
                x += node.getSize().width;
            } else {
                x -= loading.get('size').width;
            }
        }

        loading.position(x, y);

        _graph.addCell(loading);
        node.embed(loading);

        return loading;
    }

    function _removeLoading (loading) {
        loading.remove();
    }

    // inner class
    function TransitiveCore () {
        var self = this;
        var _repeatedElements = [];
        var _expandCounter = 0;

        self.initialNode = null;
        self.inUse = false;
        
        self.start = function (initialNode) {
            if (
                !initialNode.configurationSet.expandTransitively ||
                !(initialNode instanceof Node)
            ) return;
            
            self.initialNode = initialNode;
            _repeatedElements = [];
            _expandCounter = 0;

            _expandTransitively(initialNode);
        };

        function _expandTransitively (initialNode) {
            expandNode(initialNode, function (root, nodes) {
                _recursiveCall(nodes);
            });

            function expandNode (root, callback) {
                if (_repeatedElements.indexOf(root.dataModel.typeId) !== -1) {
                    if (callback) callback(root, null);
                    return;
                }

                _repeatedElements.push(root.dataModel.typeId);
                _expandCounter++;

                if (root instanceof Node && !root.get('expanded')) {
                    if (!root.get('hidden')) {
                        var loading = _addLoading(root);
                        _setLinkPaginationControlsInactive();
                        _asynkOperation = true;
                    }
                    
                    requestAnimationFrame(function () {
                        _requestData(
                            root.typeId,
                            function successCallback (result, props) {
                                root.set('expanded', true);

                                if (!root.get('hidden')) {
                                    _setLinkPaginationControlActive(root);
                                    _asynkOperation = false;
                                    _removeLoading(loading);
                                }

                                _expandNode(root, result, props && props.fromCache);
                                if (!root.get('hidden')) {
                                    _layout.recalculateLayout();
                                    _paperScroller.zoomToFit();
                                }
                                if (callback) callback(root, root.getVisibleChildren(true));
                            },
                            function (message) {

                                if (!root.get('hidden')) {
                                    _setLinkPaginationControlActive(root);
                                    _asynkOperation = false;
                                    _removeLoading(loading);
                                }

                                new joint.ui.Dialog({
                                    type: 'alert',
                                    width: 300,
                                    title: 'Alert',
                                    content: message
                                }).open();

                                if (callback) callback(root, []);
                            }
                        );
                    });
                } else if (root.get('expanded')) {
                    if (callback) callback(root, root.getVisibleChildren(true));
                }
            }

            function _recursiveCall (nodes) {
                var index = 0;
                var nextNodes = [];
                var shouldBeOpened = nodes.length;
                recursiveCycle(index);

                function recursiveCycle (index) {
                    var node = nodes[index];
                    if (node) {
                        if (_expandCounter >= _options.TRANSITIVE_EXPANSION_LIMIT_STEP) {
                            var dialog = new joint.ui.Dialog({
                                type: 'neutral',
                                width: 300,
                                title: 'Alert',
                                content: 'The ' + (_repeatedElements.length) + ' nodes were expanded. Do you want to continue?',
                                closeButton: false,
                                modal: true,
                                buttons: [
                                    { action: 'continue', content: 'Continue' },
                                    { action: 'stop', content: 'Stop' }
                                ]
                            });
                            dialog.on('action:continue', function () {
                                dialog.close();
                                _expandCounter = 0;
                                expandNode(node, callBack);
                            });
                            dialog.on('action:stop', function () {
                                dialog.close();
                            });
                            dialog.open();
                        } else {
                            expandNode(node, callBack);
                        }
                    }

                    function callBack (rootNode, nNodes) {
                        if (nNodes) {
                            var filteredNodes = filterList(nNodes);
                            if (filteredNodes.length === 0 && node.pagination) {
                                var allChildren = rootNode.getChildren(true);
                                var allFiltered = filterList(allChildren);
                                if (allFiltered.length > 0) {
                                    var firstGood = allFiltered[0];
                                    rootNode.pagination.focusOnElement(firstGood);
                                    var nodesToAdd = rootNode.pagination.getCurrentNodes(true);
                                    nextNodes = nextNodes.concat(nodesToAdd);
                                }
                            } else if (filteredNodes.length !== 0) {
                                nextNodes = nextNodes.concat(nNodes);
                            }
                        } else {
                            shouldBeOpened--;
                        }

                        recursiveCycle(index + 1);
                        if (nodes.filter(function (n) { return n.get('expanded'); }).length === shouldBeOpened) {
                            _recursiveCall(nextNodes);
                        }

                        function filterList (list) {
                            return list.filter(function (n) {
                                return nextNodes.map(function (n) {
                                    return n.dataModel.typeId;
                                }).indexOf(n.dataModel.typeId) === -1;
                            });
                        }
                    }
                } 
            }
        }
    }

    // Here we call constructor after defining all functions
    _initialize.call(self, dataProvider, paperProperties, focusNodeId, resourcePath, _options);
}

module.exports = NeighborGram;



},{"./graphElements":8,"./graphLayout":9,"./popUpMenu":18,"./stateStorage":19,"file-saverjs":2,"lodash":"lodash","rappid":"rappid","visualizations-library":4}],17:[function(require,module,exports){
var joint = require('rappid');
var _ = require('lodash');
var CrossNode = require('./graphElements').CrossNode;

var defaultOptions = {DEFAULT_PAGE_SIZE: 5};

// Create a custom element.
// ------------------------

if (!joint.shapes.html) joint.shapes.html = {};

joint.shapes.html.Pagination = joint.shapes.basic.Rect.extend({
    defaults: joint.util.deepSupplement({
        type: 'html.Pagination',
        attrs: {
            rect: {stroke: 'none', 'fill-opacity': 0, style: {'pointer-events': 'none'}}
        }
    }, joint.shapes.basic.Rect.prototype.defaults)
});

// Create a custom view for that element that displays an HTML div above it.
// -------------------------------------------------------------------------

joint.shapes.html.PaginationView = joint.dia.ElementView.extend({

    template: [
        '<button type="button" class="ng-prev" title="Prev"></button>',
        '<div class="ng-pages"><span class="ng-pages-cur"></span>/<span class="ng-pages-total"></span></div>',
        '<button type="button" class="ng-next" title="Next"></button>'
    ].join(''),

    initialize: function () {
        _.bindAll(this, 'updateBox');
        joint.dia.ElementView.prototype.initialize.apply(this, arguments);

        this.box = document.createElement('div');

        if (this.model.getType() === 'nodes') {
            this.box.className = 'ng-pagination-nodes';
        } else {
            this.box.className = 'ng-pagination-edges';
        }

        this.box.innerHTML = this.template;

        // Events
        var self = this;

        var buttonPrev = this.box.querySelector('.ng-prev');
        var buttonNext = this.box.querySelector('.ng-next');

        buttonPrev.onclick = function () {
            self.model.prev();
            updateButtonsState();
        };
        buttonNext.onclick = function () {
            self.model.next();
            updateButtonsState();
        };

        function updateButtonsState () {
            buttonPrev.disabled = self.model.state.curPage === 0;
            buttonNext.disabled = self.model.state.curPage === self.model.state.pageCount - 1;
        }
        updateButtonsState();

        // Update the box position whenever the underlying model changes.
        this.model.on('change', this.updateBox, this);
        // Remove the box when the model gets removed from the graph.
        this.model.on('remove', this.removeBox, this);
        // if we use zoom +/-
        this.model.on('updateViewPosition', this.updateBox, this);

        this.model.on('setActive', function () {
            this.addClass('active');
        }, this);
        this.model.on('setInactive', function () {
            this.removeClass('active');
        }, this);

        this.model.on('startLoading', function () {
            this.addClass('loading');
        }, this);
        this.model.on('finishLoading', function () {
            this.removeClass('loading');
            this.updatePages();
        }, this);

        this.updateBox();
        this.updatePages();
    },
    render: function () {
        joint.dia.ElementView.prototype.render.apply(this, arguments);
        this.paper.el.appendChild(this.box);
        this.updateBox();
        return this;
    },
    updateBox: function () {
        var bbox = this.model.getMyBBox();

        this.box.style.width = bbox.width + 'px';
        this.box.style.height = bbox.height + 'px';
        this.box.style.left = bbox.x + 'px';
        this.box.style.top = bbox.y + 'px';
        this.box.style.transform = 'rotate(' + (this.model.get('angle') || 0) + 'deg)';
    },
    removeBox: function () {
        this.box.remove();
    },
    updatePages: function () {
        this.box.querySelector('.ng-pages-cur').innerHTML = this.model.getState().curPage + 1;
        this.box.querySelector('.ng-pages-total').innerHTML = this.model.getState().pageCount;
    },
    addClass: function (className) {
        this.box.className = this.box.className + ' ' + className;
    },
    removeClass: function (className) {
        var box = this.box;
        var classes = box.className.split(' ');

        for (var i = 0; i < classes.length; i++) {
            if (classes[i] == className) {
                classes.splice(i, 1);
                i--;
            }
        }
        box.className = classes.join(' ');
    }
});

/**
 * Pagination - it will be new graph element,
 * which provides pagination
 *
 * Constructor parameters:
 *      node: Node
 *      _layout: GraphLayout
 *      pageSize: number
 *      type: string
 *      _options: {
 *          DEFAULT_PAGE_SIZE: number, 
 *          COLOR_CLASS_COUNT: number, 
 *          MAX_LABEL_LENGTH: number, 
 *          COL_OFFSET: number, 
 *          ROW_OFFSET: number, 
 *          CROSS_NODE_OFFSET: number, 
 *          COLOR_CLASS_MAP: {
 *              'subClassOf': string, 
 *              'type': string
 *          }
 *      }
 *
 * Public methods:
 *      next(): void
 *      prev(): void
 *      getState(): { totalCount: number, pageSize: number, curPage: number, pageCount: number }
 *      getType(): string
 *      getMyBBox(): return {width: number, height: number, x: number, y: number}
 *      updateViewPosition(): void
 *      setActive(): void
 *      setInactive(): void
 */
function Pagination (node, _layout, pageSize, type, _options) {
    var self = this;

    var DEFAULT_PAGE_SIZE = (_options && _options.DEFAULT_PAGE_SIZE != undefined ? _options.DEFAULT_PAGE_SIZE : defaultOptions.DEFAULT_PAGE_SIZE);

    function initialize (node, layout, pageSize, type) {

        var totalCount = node.getChildren().length;
        pageSize = (pageSize ? pageSize : DEFAULT_PAGE_SIZE);


        self.state = {
            totalCount: totalCount,
            pageSize: pageSize,
            curPage: 0,
            prevPage: 0,
            pageCount: Math.ceil(totalCount / pageSize)
        };
        self.type = type;
        self.refreshLayout = layout.recalculateLayout;

        var options = self.type === 'nodes' ? {size: {width: 100, height: 23}} : {size: {width: 20, height: 46}};

        joint.shapes.html.Pagination.apply(self, [options]);
    }

    // go to next page
    self.next = function () {
        if (self.state.curPage < self.state.pageCount - 1) {
            self.trigger('startLoading');
            self.state.prevPage = self.state.curPage;
            self.state.curPage++;
            setTimeout(function () {
                self.refreshLayout();
                self.trigger('finishLoading');
            }, 50);
        }
    };

    // returns nodes of current page
    self.getCurrentNodes = function (expandCrossNodes) {
        var pageSize = self.state.pageSize;
        var curPage =  self.state.curPage;
        var children = node.getChildren(expandCrossNodes);
        return children.slice(pageSize * curPage, (curPage + 1) * pageSize);
    };

    // go to previous page
    self.prev = function () {
        if (self.state.curPage !== 0) {
            self.trigger('startLoading');
            self.state.prevPage = self.state.curPage;
            self.state.curPage--;
            setTimeout(function () {
                self.refreshLayout();
                self.trigger('finishLoading');
            }, 50);
        }
    };

    // go to specific page
    self.goTo = function (number) {
        if (
            number <= self.state.pageCount &&
            number >= 0 &&
            number !== self.state.curPage
        ) {
            self.trigger('startLoading');
            self.state.prevPage = self.state.curPage;
            self.state.curPage = number;
            setTimeout(function () {
                self.refreshLayout();
                self.trigger('finishLoading');
            }, 50);
        }
    };

    self.getPageByElementIndex = function (index) {
        if (index > self.state.totalCount) return -1;
        return Math.floor(index / self.state.pageSize);
    };

    self.focusOn = function (elementIndex) {
        self.goTo(self.getPageByElementIndex(elementIndex));
    };

    self.focusOnElement = function (element) {
        var children = node.getChildren();
        var index = children.indexOf(element);
        if (index === -1) {
            var crossNodes = children.filter(function (n) {
                return n instanceof CrossNode;
            });
            for (var i = 0; i < crossNodes.length; i++) {
                var crossChildren = crossNodes[i].getChildren();
                if (crossChildren.indexOf(element) !== -1) {
                    if (crossChildren.pagination) crossChildren.pagination.focusOnElement(element);
                    index = children.indexOf(crossNodes[i]);
                    return self.goTo(self.getPageByElementIndex(index));
                }
            }
        } else {
            return self.goTo(self.getPageByElementIndex(index));
        }
    };


    self.getState = function () {
        return self.state;
    };

    self.getType = function () {
        return self.type;
    };

    self.getMyBBox = function () {
        var size = self.get('size');
        var position = self.position();
        var scale = _layout.getScale();
        return {
            width: size.width,
            height: size.height,
            x: position.x * scale.sx,
            y: position.y * scale.sy
        };
    };

    self.updateViewPosition = function () {
        self.trigger('updateViewPosition');
    };

    self.setActive = function () {
        self.trigger('setActive');
    };

    self.setInactive = function () {
        self.trigger('setInactive');
    };

    initialize(node, _layout, pageSize, type);
}
Pagination.prototype = Object.create(joint.shapes.html.Pagination.prototype);

module.exports = Pagination;

},{"./graphElements":8,"lodash":"lodash","rappid":"rappid"}],18:[function(require,module,exports){
'use strict';
var cloneDeep = require('lodash').cloneDeep;

/**
 * 
 * @param {
 *  base: HTMLElement,
 *  target: Node,
 *  scroller: joint.ui.PaperScroller
 * } _options 
 */
function PopUpMenu (options) {
    var self = this;
    // ============================================
    self.alive = true;
    self.tempConfiguration = cloneDeep(options.target.configurationSet);
    self.tempConfiguration.modified = true;

    var _base = options.base;
    var _target = self.target = options.target;
    var _scroller = options.scroller;

    var _searchInput = null;
    var _linksRow = null;
    var _radioButtons = null;
    
    var _root = document.createElement('DIV');
    _createMarkup();

    var targetPosition = _getTargetPosition();
    _updatePosition(targetPosition);

    if (_target && _target.on) {
        _target.on('change:position', function () {
            _refresh();
        });
    }

    _scroller.options.paper.on('blank:pointerdown', function () {
        self.remove();
    });

    _scroller.options.paper.on('change:customPosition', function () {
        self.refresh();
    });

    _target.on('change:hidden', function () {
        self.remove();
    });

    _scroller.scrollToElement(_target);

    // ============================================

    self.remove = function () {
        if (self.alive) {
            _base.removeChild(_root);
            self.alive = false;
        }
    };

    self.refresh = function () {
        if (self.alive) {
            _refresh();
        }
    };

    self.putData = function (edges) {
        var connections = _createConnectionsList(edges);
        _target.configurationSet.connections = connections;
        _refresh();
    };

    function _createMarkup () {
        _root.className = 'ng-ui_pop-up';
        _root.style.position = 'relative';
        _base.appendChild(_root);

        var body = document.createElement('DIV');
        body.className = 'ng-ui_pop-up_body';
        _root.appendChild(body);

        var searchRow = createRow('ng-ui_pop-up_body_search-row');
        _searchInput = document.createElement('INPUT');
        _searchInput.setAttribute('type', 'text');
        _searchInput.setAttribute('placeholder', 'Search..');
        _searchInput.className='ng-ui_pop-up_body_search-row__input';
        searchRow.appendChild(_searchInput);
        _searchInput.onkeyup = function () {
            self.tempConfiguration.filterKey = _searchInput.value;
            _updateConnectionList();
        };

        var radioRow = createRow('ng-ui_pop-up_body_radio-row', 'FORM');
        radioRow.name = 'filterTypeForm';
        radioRow.innerHTML = 
            '<span class="ng-ui_pop-up_body_radio-row__radio-button">' + 
                '<input class="ng-ui_pop-up_body_radio-row__radio-button-input" name="filterType" value="ALL" type="radio" />' +
                '<img class="ng-all-connections"/>' +
                '<label> Both</label>' +
            '</span>' +
            '<span class="ng-ui_pop-up_body_radio-row__radio-button">' + 
                '<input class="ng-ui_pop-up_body_radio-row__radio-button-input" name="filterType" value="INCOMING" type="radio" />' +
                '<img class="ng-incoming-connections"/>' +
                '<label> Incoming</label>' +
            '</span>' +
            '<span class="ng-ui_pop-up_body_radio-row__radio-button">' + 
                '<input class="ng-ui_pop-up_body_radio-row__radio-button-input" name="filterType" value="OUTGOING" type="radio" />' +
                '<img class="ng-outgoing-connections"/>' +
                '<label> Outgoing</label>' +
            '</span>';
        _radioButtons = document.querySelector('form[name=filterTypeForm]').querySelectorAll('input[name=filterType]');
        for(var i = 0; i < _radioButtons.length; i++) {
            _radioButtons[i].onclick = function () {
                self.tempConfiguration.filterType = this.value;
                _updateConnectionList();
            };
        }
        var radioRowButtons = radioRow.querySelectorAll('.ng-ui_pop-up_body_radio-row__radio-button');
        for (i = 0; i < radioRowButtons.length; i++) {
            radioRowButtons[i].onclick = function () {
                var input = this.querySelector('input');
                input.checked = true;
                self.tempConfiguration.filterType = input.value;
                _updateConnectionList();
            };
        }

        var transitiveRow = createRow('ng-ui_pop-up_body_transitive-row');
        var transitiveCheckBox = document.createElement('INPUT');
        transitiveCheckBox.setAttribute('type', 'checkBox');
        transitiveCheckBox.checked = self.tempConfiguration.expandTransitively;
        transitiveRow.appendChild(transitiveCheckBox);
        transitiveRow.onclick = function () {
            transitiveCheckBox.checked = !transitiveCheckBox.checked;
            self.tempConfiguration.expandTransitively = transitiveCheckBox.checked;
        };
        var transitiveLabel = document.createElement('LABEL');
        transitiveLabel.innerText = 'Transitive expansion';
        transitiveRow.appendChild(transitiveLabel);

        _linksRow = createRow('ng-ui_pop-up_body_links-row');
        _updateConnectionList (_linksRow);

        var buttonsRow = createRow('ng-ui_pop-up_body_buttons-row');

        var selectAll = document.createElement('BUTTON');
        selectAll.className = 'ng-ui_pop-up_body_buttons-row_button tq-button';
        selectAll.innerText = 'Select all';
        buttonsRow.appendChild(selectAll);
        selectAll.onclick = function () {
            checkAll(true);
            _updateConnectionList();
        };

        var clearSelection = document.createElement('BUTTON');
        clearSelection.className = 'ng-ui_pop-up_body_buttons-row_button tq-button';
        clearSelection.innerText = 'Clear selection';
        buttonsRow.appendChild(clearSelection);
        clearSelection.onclick = function () {
            checkAll(false);
            _updateConnectionList();
        };

        var span = document.createElement('SPAN');
        span.style.flexGrow = 1;
        buttonsRow.appendChild(span);

        var resetFilter = document.createElement('BUTTON');
        resetFilter.className = 'ng-ui_pop-up_body_buttons-row_button tq-button';
        resetFilter.innerText = 'Reset filter';
        buttonsRow.appendChild(resetFilter);
        resetFilter.onclick = function () {
            var parent = _target.getParent();
            if (options.beforeApply) options.beforeApply(_target.configurationSet);
            
            if (parent) {
                _target.configurationSet = cloneDeep(parent.configurationSet);
            } else {
                _target.configurationSet = {
                    filterType: 'ALL', // INCOMING, OUTGOING
                    filterKey: '',
                    visibilityMap: {},
                    visibilityMapReverse: {},
                };
            }

            _target.configurationSet.connections = self.tempConfiguration.connections;
            _target.configurationSet.modified = false;
            self.tempConfiguration = cloneDeep(_target.configurationSet);
            self.tempConfiguration.modified = true;
            _updateConnectionList();
            self.remove();

            if (options.afterApply) options.afterApply(_target.configurationSet);
        };

        var go = document.createElement('BUTTON');
        go.className = 'ng-ui_pop-up_body_buttons-row_button go-button';
        go.innerText = 'Go';
        go.onclick = function () {
            if (options.beforeApply) options.beforeApply(_target.configurationSet);

            _target.configurationSet = self.tempConfiguration;
            self.remove();
            
            if (options.afterApply) options.afterApply(_target.configurationSet);
        };

        buttonsRow.appendChild(go);

        function createRow (className, teg) {
            var row = document.createElement(teg || 'DIV');
            row.className = className;
            body.appendChild(row);
            return row;
        }

        function checkAll (value) {
            var config = self.tempConfiguration;
            var filteredConnections = filterConnections(config);
            filteredConnections.forEach(function (conection) {
                conection.checked = value;
            });
        }
    }

    function _updateConnectionList () {
        if (self.tempConfiguration.connections) {
            for(var i = 0; i < _radioButtons.length; i++) {
                if(_radioButtons[i].value === self.tempConfiguration.filterType) {
                    _radioButtons[i].checked = true;
                    break;
                }
            }

            if (_searchInput.value !== self.tempConfiguration.filterKey) {
                _searchInput.value = self.tempConfiguration.filterKey;
            }

            if (self.tempConfiguration.connections.length === 0) {
                _linksRow.innerHTML = '<div class="ng-ui_pop-up_body_links-row__disabled">List is empty</div>';
            } else {
                _linksRow.innerHTML = '';

                var div = document.createElement('DIV');
                div.className = 'ng-ui_pop-up_body_links-row_container';
                _linksRow.appendChild(div);

                var list = document.createElement('UL');
                list.className = 'ng-ui_pop-up_body_links-row_container_connection-list';
                fillList(list);
                div.appendChild(list);
            }
        }else {
            _linksRow.innerHTML = '<div class="ng-ui_pop-up_body_links-row__disabled">Loading..</div>';
        }

        function fillList (listRoot) {
            var config = self.tempConfiguration;
            
            var filteredConnections = filterConnections(config);
            filteredConnections.forEach(function (connection) {
                listRoot.appendChild(calculateConnectionRows(connection));
            });
        }

        function calculateConnectionRows (connection) {
            var row = document.createElement('DIV');
            row.className = 'ng-ui_pop-up_body_links-row_container_connection-list_row';
            row.setAttribute('title', connection.label);

            // connection checkBox
            // ----------------------------------

            var checkBox = document.createElement('INPUT');
            checkBox.setAttribute('type', 'checkBox');
            checkBox.checked = connection.checked;
            checkBox.style.pointerEvents = 'none';
            row.appendChild(checkBox);
            function updateCheckBoxValue () {
                if (connection.direction) {
                    self.tempConfiguration.visibilityMap[connection.typeId] = checkBox.checked;
                } else {
                    self.tempConfiguration.visibilityMapReverse[connection.typeId] = checkBox.checked;
                }
            }
            updateCheckBoxValue();
            row.onclick = function () {
                checkBox.checked = !checkBox.checked;
                connection.checked = checkBox.checked;
                updateCheckBoxValue();
            };
            
            // Icon
            // ----------------------------------

            var image = document.createElement('IMG');
            image.className = connection.direction ? 'ng-ui_pop-up_body_links-row_container_connection-list_row__incoming-image'
                                             : 'ng-ui_pop-up_body_links-row_container_connection-list_row__outgoing-image';
            row.appendChild(image);

            // Label
            // ----------------------------------

            var label = document.createElement('SPAN');
            label.className = 'ng-ui_pop-up_body_links-row_container_connection-list_row__label';
            label.innerText = connection.label; 
            row.appendChild(label);

            // Buble counter
            // ----------------------------------

            var bubble = document.createElement('SPAN');
            bubble.className = 'ng-ui_pop-up_body_links-row_container_connection-list_row__bubble';
            bubble.innerText = connection.count; 
            row.appendChild(bubble);

            return row;
        }
    }

    function filterConnections (config) {
        return self.tempConfiguration.connections.filter(function (connection) {
            return (config.filterType === 'ALL' ||
                    config.filterType === 'INCOMING' && connection.direction ||
                    config.filterType === 'OUTGOING' && !connection.direction) &&
                    (!config.filterKey || config.filterKey && connection.label.toLowerCase().indexOf(config.filterKey.toLowerCase()) !== -1);
        });
    }

    function _createConnectionsList (edges) {
        var connectionCounter = {};
        var connectionCounterReverse = {};
        var config = self.tempConfiguration;

        function putIntoMap (edges, label) {
            edges.forEach(function (edge) {
                var map = null;
                var checkMap = null;
                var direction = _target.dataModel.typeId === edge.target;
                
                if (direction) {
                    map = connectionCounter;
                    checkMap = config.visibilityMap;
                } else {
                    map = connectionCounterReverse;
                    checkMap = config.visibilityMapReverse;
                }
                if (!map[edge.id]) {
                    map[edge.id] = {
                        typeId: edge.id,
                        label: label || edge.label,
                        count: 1,
                        direction: direction,
                        checked: checkMap[edge.id] || checkMap[edge.id] === undefined,
                    };
                } else {
                    map[edge.id].count++;
                }
            });
        }
        putIntoMap(edges);

        return Object.keys(connectionCounter).map(function (key) { return connectionCounter[key]; }).concat(
            Object.keys(connectionCounterReverse).map(function (key) { return connectionCounterReverse[key]; })
        ).sort(function (a, b) {
            if (a.label > b.label) {
                return 1;
            } else if (a.label < b.label) {
                return -1;
            } else {
                if (a.direction && !b.direction) {
                    return 1;
                } else if (!a.direction && b.direction) {
                    return -1;
                } else {
                    return 0;
                }
            }
        });
    }

    function _refresh () {
        self.tempConfiguration = cloneDeep(_target.configurationSet);
        self.tempConfiguration.modified = true;
        
        targetPosition = _getTargetPosition(_target);
        _updatePosition(targetPosition);
        _updateConnectionList();
    }

    function _getTargetPosition () {
        if (_target && _target.position) return _target.position();
        else return { x: 0, y: 0 };
    }

    function _updatePosition (position) {
        var targetSize = _target.get('size');
        var popUpSize = { width: _root.clientWidth, height: _root.clientHeight };
        
        if (_target.getDirection()) {
            setToTheEast();
        } else {
            setToTheWest();
        }

        function setToTheEast () {
            _root.style.left = (position.x + targetSize.width) * _scroller._sx + 'px';
            _root.style.top = (position.y + targetSize.height / 2) * _scroller._sx - popUpSize.height / 2 + 'px';
        }

        function setToTheWest () {
            _root.style.left = (position.x) * _scroller._sx - popUpSize.width + 'px';
            _root.style.top = (position.y + targetSize.height / 2) * _scroller._sx - popUpSize.height / 2 + 'px';
        }
    }
}

module.exports = PopUpMenu;

},{"lodash":"lodash"}],19:[function(require,module,exports){
'use strict';
var cloneDeep = require('lodash').cloneDeep;

var DEFAULT_DECK_LENGTH = 4;

/**
 * Description
 * 
 * Constructor parameters
 *  @param {GraphLayout} layout
 *  @param {Object} parameters

 * Public methods:
 * pushState (): void
 * getHistory: {
 *  states: [],
 *  currentIndex: number,
 * }
 * undoState (): void
 * redoState (): void
 */
function StateStorage (layout, parameters) {
    var self = this;
    if (!parameters) parameters = {};

    var _layout = layout;
    var _stateDeck = [];
    var _stateMap = {};
    var _deckLength = parameters.deckLength || DEFAULT_DECK_LENGTH;
    var _currentIndex = -1;

    self.pushState = function () {
        if (_stateDeck.length - 1 > _currentIndex) {
            _stateDeck.splice(_currentIndex + 1, _stateDeck.length);
        }
        if (_saveState()) {
            _check();
            _currentIndex = _stateDeck.length;
        }
    };

    self.getHistory = function () {
        return {
            states: cloneDeep(_stateDeck),
            currentIndex: _currentIndex,
        };
    };

    self.undoState = function () {
        if (_currentIndex === _stateDeck.length) {
            if (_saveState()) {
                _check();
            }
        } else {
            _updateMap();
        }
        if (_currentIndex > 0) {
            _currentIndex--;
            return _returnState();
        } else {
            return null;
        }
    };

    self.redoState = function () {
        _updateMap();
        if (_currentIndex + 1 < _stateDeck.length) {
            _currentIndex++;
            return _returnState();
        } else {
            return null;
        }
    };
    
    function _returnState () {
        return _stateMap[_stateDeck[_currentIndex]];
    }

    function _saveState () {
        var state = _layout.getState();
        if (state.rootNode) {
            _stateMap[state.rootNode.typeId] = state;

            if (_stateDeck[_stateDeck.length - 1] !== state.rootNode.typeId) _stateDeck.push(state.rootNode.typeId);
            return true;
        } else {
            return false;
        }
    }

    function _updateMap () {
        var state = _layout.getState();
        if (state.rootNode) {
            _stateMap[state.rootNode.typeId] = state;
        }
    }

    function _check () {
        if (_stateDeck.length > _deckLength) _stateDeck.shift();

        Object.keys(_stateMap).forEach(function (key) {
            if (_stateDeck.indexOf(key) === -1) {
                if(!delete _stateMap[key]) {
                    _stateMap[key] = undefined;
                }
            }
        });
    }
}

module.exports = StateStorage;


},{"lodash":"lodash"}],20:[function(require,module,exports){
var _ = require('lodash');

/** 
 * It's base class which provides subscription API for successors.
 * @class
*/

function Subscribable () {
    var self = this;
    self._subscribtions = {};

    /**
     * Method allows to subscribe on a some specific event.
     * @param {string} event - event id
     * @param {function} callback - event handler
     * @memberof Subscribable
     * @method
    */
    self.on = function (event, callback) {
        if (!self._subscribtions[event]) self._subscribtions[event] = [];
        self._subscribtions[event].push(callback);
    };

    /**
     * Method allows to unsubscribe from a some specific event.
     * @param {function} callback - event handler
     * @memberof Subscribable
     * @method
    */
    self.unsubscribe = function (callback) {
        _.values(self._subscribtions).forEach(function (subscribers) {
            var index = subscribers.indexOf(callback);
            if (index !== -1) subscribers.splice(index, 1);
        });
    };

    /**
     * Method which fires the event.
     * @param {string} event - event id
     * @param {Object[]} parameters
     * @memberof Subscribable
     * @method
    */
    self.trigger = function (event, parameters) {
        if (!(parameters instanceof Array)) parameters = [parameters];
        if (self._subscribtions && self._subscribtions[event]) {
            self._subscribtions[event].forEach(function (c) {
                c.apply(this, parameters);
            });
        }
    };
}
module.exports = Subscribable;

},{"lodash":"lodash"}]},{},[15])(15)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXM2LXByb21pc2UvZGlzdC9lczYtcHJvbWlzZS5qcyIsIm5vZGVfbW9kdWxlcy9maWxlLXNhdmVyanMvRmlsZVNhdmVyLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy92aXN1YWxpemF0aW9ucy1saWJyYXJ5L2J1aWxkL2pzL21haW4ubWluLmpzIiwibm9kZV9tb2R1bGVzL3doYXR3Zy1mZXRjaC9mZXRjaC5qcyIsInNyYy9qcy9jb2xvckNvbmZpZ3VyYXRvci5qcyIsInNyYy9qcy9kYXRhUHJvdmlkZXIuanMiLCJzcmMvanMvZ3JhcGhFbGVtZW50cy5qcyIsInNyYy9qcy9ncmFwaExheW91dC5qcyIsInNyYy9qcy9odG1sVUkvZGVmYXVsdFVJLmpzIiwic3JjL2pzL2h0bWxVSS9pbmZvUGFuZWwuanMiLCJzcmMvanMvaHRtbFVJL29wdGlvbnNQYW5lbC5qcyIsInNyYy9qcy9sYXlvdXRQYWdpbmF0aW9uTWFuYWdlci5qcyIsInNyYy9qcy9sYXlvdXRQb3NpdGlvbk1hbmFnZXIuanMiLCJzcmMvanMvbWFpbi5qcyIsInNyYy9qcy9uZWlnaGJvckdyYW0uanMiLCJzcmMvanMvcGFnaW5hdGlvbi5qcyIsInNyYy9qcy9wb3BVcE1lbnUuanMiLCJzcmMvanMvc3RhdGVTdG9yYWdlLmpzIiwic3JjL2pzL3N1YnNjcmlwdGlvbkFQSS9zdWJzY3JpYmVhYmxlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqb0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hMQTs7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsb0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOW1CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5akJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2c0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwYUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyohXG4gKiBAb3ZlcnZpZXcgZXM2LXByb21pc2UgLSBhIHRpbnkgaW1wbGVtZW50YXRpb24gb2YgUHJvbWlzZXMvQSsuXG4gKiBAY29weXJpZ2h0IENvcHlyaWdodCAoYykgMjAxNCBZZWh1ZGEgS2F0eiwgVG9tIERhbGUsIFN0ZWZhbiBQZW5uZXIgYW5kIGNvbnRyaWJ1dG9ycyAoQ29udmVyc2lvbiB0byBFUzYgQVBJIGJ5IEpha2UgQXJjaGliYWxkKVxuICogQGxpY2Vuc2UgICBMaWNlbnNlZCB1bmRlciBNSVQgbGljZW5zZVxuICogICAgICAgICAgICBTZWUgaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL3N0ZWZhbnBlbm5lci9lczYtcHJvbWlzZS9tYXN0ZXIvTElDRU5TRVxuICogQHZlcnNpb24gICAzLjMuMVxuICovXG5cbihmdW5jdGlvbiAoZ2xvYmFsLCBmYWN0b3J5KSB7XG4gICAgdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnID8gbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCkgOlxuICAgIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZShmYWN0b3J5KSA6XG4gICAgKGdsb2JhbC5FUzZQcm9taXNlID0gZmFjdG9yeSgpKTtcbn0odGhpcywgKGZ1bmN0aW9uICgpIHsgJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBvYmplY3RPckZ1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB4ICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nO1xufVxuXG52YXIgX2lzQXJyYXkgPSB1bmRlZmluZWQ7XG5pZiAoIUFycmF5LmlzQXJyYXkpIHtcbiAgX2lzQXJyYXkgPSBmdW5jdGlvbiAoeCkge1xuICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gIH07XG59IGVsc2Uge1xuICBfaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG59XG5cbnZhciBpc0FycmF5ID0gX2lzQXJyYXk7XG5cbnZhciBsZW4gPSAwO1xudmFyIHZlcnR4TmV4dCA9IHVuZGVmaW5lZDtcbnZhciBjdXN0b21TY2hlZHVsZXJGbiA9IHVuZGVmaW5lZDtcblxudmFyIGFzYXAgPSBmdW5jdGlvbiBhc2FwKGNhbGxiYWNrLCBhcmcpIHtcbiAgcXVldWVbbGVuXSA9IGNhbGxiYWNrO1xuICBxdWV1ZVtsZW4gKyAxXSA9IGFyZztcbiAgbGVuICs9IDI7XG4gIGlmIChsZW4gPT09IDIpIHtcbiAgICAvLyBJZiBsZW4gaXMgMiwgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gc2NoZWR1bGUgYW4gYXN5bmMgZmx1c2guXG4gICAgLy8gSWYgYWRkaXRpb25hbCBjYWxsYmFja3MgYXJlIHF1ZXVlZCBiZWZvcmUgdGhlIHF1ZXVlIGlzIGZsdXNoZWQsIHRoZXlcbiAgICAvLyB3aWxsIGJlIHByb2Nlc3NlZCBieSB0aGlzIGZsdXNoIHRoYXQgd2UgYXJlIHNjaGVkdWxpbmcuXG4gICAgaWYgKGN1c3RvbVNjaGVkdWxlckZuKSB7XG4gICAgICBjdXN0b21TY2hlZHVsZXJGbihmbHVzaCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNjaGVkdWxlRmx1c2goKTtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHNldFNjaGVkdWxlcihzY2hlZHVsZUZuKSB7XG4gIGN1c3RvbVNjaGVkdWxlckZuID0gc2NoZWR1bGVGbjtcbn1cblxuZnVuY3Rpb24gc2V0QXNhcChhc2FwRm4pIHtcbiAgYXNhcCA9IGFzYXBGbjtcbn1cblxudmFyIGJyb3dzZXJXaW5kb3cgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHVuZGVmaW5lZDtcbnZhciBicm93c2VyR2xvYmFsID0gYnJvd3NlcldpbmRvdyB8fCB7fTtcbnZhciBCcm93c2VyTXV0YXRpb25PYnNlcnZlciA9IGJyb3dzZXJHbG9iYWwuTXV0YXRpb25PYnNlcnZlciB8fCBicm93c2VyR2xvYmFsLldlYktpdE11dGF0aW9uT2JzZXJ2ZXI7XG52YXIgaXNOb2RlID0gdHlwZW9mIHNlbGYgPT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAoe30pLnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJztcblxuLy8gdGVzdCBmb3Igd2ViIHdvcmtlciBidXQgbm90IGluIElFMTBcbnZhciBpc1dvcmtlciA9IHR5cGVvZiBVaW50OENsYW1wZWRBcnJheSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGltcG9ydFNjcmlwdHMgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gJ3VuZGVmaW5lZCc7XG5cbi8vIG5vZGVcbmZ1bmN0aW9uIHVzZU5leHRUaWNrKCkge1xuICAvLyBub2RlIHZlcnNpb24gMC4xMC54IGRpc3BsYXlzIGEgZGVwcmVjYXRpb24gd2FybmluZyB3aGVuIG5leHRUaWNrIGlzIHVzZWQgcmVjdXJzaXZlbHlcbiAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jdWpvanMvd2hlbi9pc3N1ZXMvNDEwIGZvciBkZXRhaWxzXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHByb2Nlc3MubmV4dFRpY2soZmx1c2gpO1xuICB9O1xufVxuXG4vLyB2ZXJ0eFxuZnVuY3Rpb24gdXNlVmVydHhUaW1lcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2ZXJ0eE5leHQoZmx1c2gpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VNdXRhdGlvbk9ic2VydmVyKCkge1xuICB2YXIgaXRlcmF0aW9ucyA9IDA7XG4gIHZhciBvYnNlcnZlciA9IG5ldyBCcm93c2VyTXV0YXRpb25PYnNlcnZlcihmbHVzaCk7XG4gIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICBvYnNlcnZlci5vYnNlcnZlKG5vZGUsIHsgY2hhcmFjdGVyRGF0YTogdHJ1ZSB9KTtcblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIG5vZGUuZGF0YSA9IGl0ZXJhdGlvbnMgPSArK2l0ZXJhdGlvbnMgJSAyO1xuICB9O1xufVxuXG4vLyB3ZWIgd29ya2VyXG5mdW5jdGlvbiB1c2VNZXNzYWdlQ2hhbm5lbCgpIHtcbiAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gY2hhbm5lbC5wb3J0Mi5wb3N0TWVzc2FnZSgwKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlU2V0VGltZW91dCgpIHtcbiAgLy8gU3RvcmUgc2V0VGltZW91dCByZWZlcmVuY2Ugc28gZXM2LXByb21pc2Ugd2lsbCBiZSB1bmFmZmVjdGVkIGJ5XG4gIC8vIG90aGVyIGNvZGUgbW9kaWZ5aW5nIHNldFRpbWVvdXQgKGxpa2Ugc2lub24udXNlRmFrZVRpbWVycygpKVxuICB2YXIgZ2xvYmFsU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGdsb2JhbFNldFRpbWVvdXQoZmx1c2gsIDEpO1xuICB9O1xufVxuXG52YXIgcXVldWUgPSBuZXcgQXJyYXkoMTAwMCk7XG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHZhciBjYWxsYmFjayA9IHF1ZXVlW2ldO1xuICAgIHZhciBhcmcgPSBxdWV1ZVtpICsgMV07XG5cbiAgICBjYWxsYmFjayhhcmcpO1xuXG4gICAgcXVldWVbaV0gPSB1bmRlZmluZWQ7XG4gICAgcXVldWVbaSArIDFdID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gYXR0ZW1wdFZlcnR4KCkge1xuICB0cnkge1xuICAgIHZhciByID0gcmVxdWlyZTtcbiAgICB2YXIgdmVydHggPSByKCd2ZXJ0eCcpO1xuICAgIHZlcnR4TmV4dCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG4gICAgcmV0dXJuIHVzZVZlcnR4VGltZXIoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiB1c2VTZXRUaW1lb3V0KCk7XG4gIH1cbn1cblxudmFyIHNjaGVkdWxlRmx1c2ggPSB1bmRlZmluZWQ7XG4vLyBEZWNpZGUgd2hhdCBhc3luYyBtZXRob2QgdG8gdXNlIHRvIHRyaWdnZXJpbmcgcHJvY2Vzc2luZyBvZiBxdWV1ZWQgY2FsbGJhY2tzOlxuaWYgKGlzTm9kZSkge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTmV4dFRpY2soKTtcbn0gZWxzZSBpZiAoQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU11dGF0aW9uT2JzZXJ2ZXIoKTtcbn0gZWxzZSBpZiAoaXNXb3JrZXIpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU1lc3NhZ2VDaGFubmVsKCk7XG59IGVsc2UgaWYgKGJyb3dzZXJXaW5kb3cgPT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgcmVxdWlyZSA9PT0gJ2Z1bmN0aW9uJykge1xuICBzY2hlZHVsZUZsdXNoID0gYXR0ZW1wdFZlcnR4KCk7XG59IGVsc2Uge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlU2V0VGltZW91dCgpO1xufVxuXG5mdW5jdGlvbiB0aGVuKG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBfYXJndW1lbnRzID0gYXJndW1lbnRzO1xuXG4gIHZhciBwYXJlbnQgPSB0aGlzO1xuXG4gIHZhciBjaGlsZCA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKG5vb3ApO1xuXG4gIGlmIChjaGlsZFtQUk9NSVNFX0lEXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbWFrZVByb21pc2UoY2hpbGQpO1xuICB9XG5cbiAgdmFyIF9zdGF0ZSA9IHBhcmVudC5fc3RhdGU7XG5cbiAgaWYgKF9zdGF0ZSkge1xuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgY2FsbGJhY2sgPSBfYXJndW1lbnRzW19zdGF0ZSAtIDFdO1xuICAgICAgYXNhcChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBpbnZva2VDYWxsYmFjayhfc3RhdGUsIGNoaWxkLCBjYWxsYmFjaywgcGFyZW50Ll9yZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSkoKTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pO1xuICB9XG5cbiAgcmV0dXJuIGNoaWxkO1xufVxuXG4vKipcbiAgYFByb21pc2UucmVzb2x2ZWAgcmV0dXJucyBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSByZXNvbHZlZCB3aXRoIHRoZVxuICBwYXNzZWQgYHZhbHVlYC4gSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlc29sdmUoMSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKDEpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gdmFsdWUgPT09IDFcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVzb2x2ZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QW55fSB2YWx1ZSB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVzb2x2ZWQgd2l0aFxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIGZ1bGZpbGxlZCB3aXRoIHRoZSBnaXZlblxuICBgdmFsdWVgXG4qL1xuZnVuY3Rpb24gcmVzb2x2ZShvYmplY3QpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICBpZiAob2JqZWN0ICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmIG9iamVjdC5jb25zdHJ1Y3RvciA9PT0gQ29uc3RydWN0b3IpIHtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG4gIF9yZXNvbHZlKHByb21pc2UsIG9iamVjdCk7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG52YXIgUFJPTUlTRV9JRCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygxNik7XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG52YXIgUEVORElORyA9IHZvaWQgMDtcbnZhciBGVUxGSUxMRUQgPSAxO1xudmFyIFJFSkVDVEVEID0gMjtcblxudmFyIEdFVF9USEVOX0VSUk9SID0gbmV3IEVycm9yT2JqZWN0KCk7XG5cbmZ1bmN0aW9uIHNlbGZGdWxmaWxsbWVudCgpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoXCJZb3UgY2Fubm90IHJlc29sdmUgYSBwcm9taXNlIHdpdGggaXRzZWxmXCIpO1xufVxuXG5mdW5jdGlvbiBjYW5ub3RSZXR1cm5Pd24oKSB7XG4gIHJldHVybiBuZXcgVHlwZUVycm9yKCdBIHByb21pc2VzIGNhbGxiYWNrIGNhbm5vdCByZXR1cm4gdGhhdCBzYW1lIHByb21pc2UuJyk7XG59XG5cbmZ1bmN0aW9uIGdldFRoZW4ocHJvbWlzZSkge1xuICB0cnkge1xuICAgIHJldHVybiBwcm9taXNlLnRoZW47XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgR0VUX1RIRU5fRVJST1IuZXJyb3IgPSBlcnJvcjtcbiAgICByZXR1cm4gR0VUX1RIRU5fRVJST1I7XG4gIH1cbn1cblxuZnVuY3Rpb24gdHJ5VGhlbih0aGVuLCB2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKSB7XG4gIHRyeSB7XG4gICAgdGhlbi5jYWxsKHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlLCB0aGVuKSB7XG4gIGFzYXAoZnVuY3Rpb24gKHByb21pc2UpIHtcbiAgICB2YXIgc2VhbGVkID0gZmFsc2U7XG4gICAgdmFyIGVycm9yID0gdHJ5VGhlbih0aGVuLCB0aGVuYWJsZSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICBpZiAoc2VhbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICBpZiAodGhlbmFibGUgIT09IHZhbHVlKSB7XG4gICAgICAgIF9yZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIGlmIChzZWFsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgc2VhbGVkID0gdHJ1ZTtcblxuICAgICAgX3JlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgIH0sICdTZXR0bGU6ICcgKyAocHJvbWlzZS5fbGFiZWwgfHwgJyB1bmtub3duIHByb21pc2UnKSk7XG5cbiAgICBpZiAoIXNlYWxlZCAmJiBlcnJvcikge1xuICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIH1cbiAgfSwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIHRoZW5hYmxlKSB7XG4gIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IEZVTEZJTExFRCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSBpZiAodGhlbmFibGUuX3N0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgIF9yZWplY3QocHJvbWlzZSwgdGhlbmFibGUuX3Jlc3VsdCk7XG4gIH0gZWxzZSB7XG4gICAgc3Vic2NyaWJlKHRoZW5hYmxlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgcmV0dXJuIF9yZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICByZXR1cm4gX3JlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkKSB7XG4gIGlmIChtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yID09PSBwcm9taXNlLmNvbnN0cnVjdG9yICYmIHRoZW4kJCA9PT0gdGhlbiAmJiBtYXliZVRoZW5hYmxlLmNvbnN0cnVjdG9yLnJlc29sdmUgPT09IHJlc29sdmUpIHtcbiAgICBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAodGhlbiQkID09PSBHRVRfVEhFTl9FUlJPUikge1xuICAgICAgX3JlamVjdChwcm9taXNlLCBHRVRfVEhFTl9FUlJPUi5lcnJvcik7XG4gICAgfSBlbHNlIGlmICh0aGVuJCQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odGhlbiQkKSkge1xuICAgICAgaGFuZGxlRm9yZWlnblRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIF9yZXNvbHZlKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgIF9yZWplY3QocHJvbWlzZSwgc2VsZkZ1bGZpbGxtZW50KCkpO1xuICB9IGVsc2UgaWYgKG9iamVjdE9yRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCB2YWx1ZSwgZ2V0VGhlbih2YWx1ZSkpO1xuICB9IGVsc2Uge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2hSZWplY3Rpb24ocHJvbWlzZSkge1xuICBpZiAocHJvbWlzZS5fb25lcnJvcikge1xuICAgIHByb21pc2UuX29uZXJyb3IocHJvbWlzZS5fcmVzdWx0KTtcbiAgfVxuXG4gIHB1Ymxpc2gocHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcHJvbWlzZS5fcmVzdWx0ID0gdmFsdWU7XG4gIHByb21pc2UuX3N0YXRlID0gRlVMRklMTEVEO1xuXG4gIGlmIChwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggIT09IDApIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHByb21pc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIF9yZWplY3QocHJvbWlzZSwgcmVhc29uKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuICAgIHJldHVybjtcbiAgfVxuICBwcm9taXNlLl9zdGF0ZSA9IFJFSkVDVEVEO1xuICBwcm9taXNlLl9yZXN1bHQgPSByZWFzb247XG5cbiAgYXNhcChwdWJsaXNoUmVqZWN0aW9uLCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKSB7XG4gIHZhciBfc3Vic2NyaWJlcnMgPSBwYXJlbnQuX3N1YnNjcmliZXJzO1xuICB2YXIgbGVuZ3RoID0gX3N1YnNjcmliZXJzLmxlbmd0aDtcblxuICBwYXJlbnQuX29uZXJyb3IgPSBudWxsO1xuXG4gIF9zdWJzY3JpYmVyc1tsZW5ndGhdID0gY2hpbGQ7XG4gIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBGVUxGSUxMRURdID0gb25GdWxmaWxsbWVudDtcbiAgX3N1YnNjcmliZXJzW2xlbmd0aCArIFJFSkVDVEVEXSA9IG9uUmVqZWN0aW9uO1xuXG4gIGlmIChsZW5ndGggPT09IDAgJiYgcGFyZW50Ll9zdGF0ZSkge1xuICAgIGFzYXAocHVibGlzaCwgcGFyZW50KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwdWJsaXNoKHByb21pc2UpIHtcbiAgdmFyIHN1YnNjcmliZXJzID0gcHJvbWlzZS5fc3Vic2NyaWJlcnM7XG4gIHZhciBzZXR0bGVkID0gcHJvbWlzZS5fc3RhdGU7XG5cbiAgaWYgKHN1YnNjcmliZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBjaGlsZCA9IHVuZGVmaW5lZCxcbiAgICAgIGNhbGxiYWNrID0gdW5kZWZpbmVkLFxuICAgICAgZGV0YWlsID0gcHJvbWlzZS5fcmVzdWx0O1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3Vic2NyaWJlcnMubGVuZ3RoOyBpICs9IDMpIHtcbiAgICBjaGlsZCA9IHN1YnNjcmliZXJzW2ldO1xuICAgIGNhbGxiYWNrID0gc3Vic2NyaWJlcnNbaSArIHNldHRsZWRdO1xuXG4gICAgaWYgKGNoaWxkKSB7XG4gICAgICBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBjaGlsZCwgY2FsbGJhY2ssIGRldGFpbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxiYWNrKGRldGFpbCk7XG4gICAgfVxuICB9XG5cbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gRXJyb3JPYmplY3QoKSB7XG4gIHRoaXMuZXJyb3IgPSBudWxsO1xufVxuXG52YXIgVFJZX0NBVENIX0VSUk9SID0gbmV3IEVycm9yT2JqZWN0KCk7XG5cbmZ1bmN0aW9uIHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gY2FsbGJhY2soZGV0YWlsKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIFRSWV9DQVRDSF9FUlJPUi5lcnJvciA9IGU7XG4gICAgcmV0dXJuIFRSWV9DQVRDSF9FUlJPUjtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbnZva2VDYWxsYmFjayhzZXR0bGVkLCBwcm9taXNlLCBjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHZhciBoYXNDYWxsYmFjayA9IGlzRnVuY3Rpb24oY2FsbGJhY2spLFxuICAgICAgdmFsdWUgPSB1bmRlZmluZWQsXG4gICAgICBlcnJvciA9IHVuZGVmaW5lZCxcbiAgICAgIHN1Y2NlZWRlZCA9IHVuZGVmaW5lZCxcbiAgICAgIGZhaWxlZCA9IHVuZGVmaW5lZDtcblxuICBpZiAoaGFzQ2FsbGJhY2spIHtcbiAgICB2YWx1ZSA9IHRyeUNhdGNoKGNhbGxiYWNrLCBkZXRhaWwpO1xuXG4gICAgaWYgKHZhbHVlID09PSBUUllfQ0FUQ0hfRVJST1IpIHtcbiAgICAgIGZhaWxlZCA9IHRydWU7XG4gICAgICBlcnJvciA9IHZhbHVlLmVycm9yO1xuICAgICAgdmFsdWUgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChwcm9taXNlID09PSB2YWx1ZSkge1xuICAgICAgX3JlamVjdChwcm9taXNlLCBjYW5ub3RSZXR1cm5Pd24oKSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhbHVlID0gZGV0YWlsO1xuICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gIH1cblxuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICAvLyBub29wXG4gIH0gZWxzZSBpZiAoaGFzQ2FsbGJhY2sgJiYgc3VjY2VlZGVkKSB7XG4gICAgICBfcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChmYWlsZWQpIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgZXJyb3IpO1xuICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gRlVMRklMTEVEKSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IFJFSkVDVEVEKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluaXRpYWxpemVQcm9taXNlKHByb21pc2UsIHJlc29sdmVyKSB7XG4gIHRyeSB7XG4gICAgcmVzb2x2ZXIoZnVuY3Rpb24gcmVzb2x2ZVByb21pc2UodmFsdWUpIHtcbiAgICAgIF9yZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiByZWplY3RQcm9taXNlKHJlYXNvbikge1xuICAgICAgX3JlamVjdChwcm9taXNlLCByZWFzb24pO1xuICAgIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgX3JlamVjdChwcm9taXNlLCBlKTtcbiAgfVxufVxuXG52YXIgaWQgPSAwO1xuZnVuY3Rpb24gbmV4dElkKCkge1xuICByZXR1cm4gaWQrKztcbn1cblxuZnVuY3Rpb24gbWFrZVByb21pc2UocHJvbWlzZSkge1xuICBwcm9taXNlW1BST01JU0VfSURdID0gaWQrKztcbiAgcHJvbWlzZS5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHVuZGVmaW5lZDtcbiAgcHJvbWlzZS5fc3Vic2NyaWJlcnMgPSBbXTtcbn1cblxuZnVuY3Rpb24gRW51bWVyYXRvcihDb25zdHJ1Y3RvciwgaW5wdXQpIHtcbiAgdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvciA9IENvbnN0cnVjdG9yO1xuICB0aGlzLnByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG5cbiAgaWYgKCF0aGlzLnByb21pc2VbUFJPTUlTRV9JRF0pIHtcbiAgICBtYWtlUHJvbWlzZSh0aGlzLnByb21pc2UpO1xuICB9XG5cbiAgaWYgKGlzQXJyYXkoaW5wdXQpKSB7XG4gICAgdGhpcy5faW5wdXQgPSBpbnB1dDtcbiAgICB0aGlzLmxlbmd0aCA9IGlucHV0Lmxlbmd0aDtcbiAgICB0aGlzLl9yZW1haW5pbmcgPSBpbnB1dC5sZW5ndGg7XG5cbiAgICB0aGlzLl9yZXN1bHQgPSBuZXcgQXJyYXkodGhpcy5sZW5ndGgpO1xuXG4gICAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG4gICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sZW5ndGggPSB0aGlzLmxlbmd0aCB8fCAwO1xuICAgICAgdGhpcy5fZW51bWVyYXRlKCk7XG4gICAgICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBfcmVqZWN0KHRoaXMucHJvbWlzZSwgdmFsaWRhdGlvbkVycm9yKCkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRpb25FcnJvcigpIHtcbiAgcmV0dXJuIG5ldyBFcnJvcignQXJyYXkgTWV0aG9kcyBtdXN0IGJlIHByb3ZpZGVkIGFuIEFycmF5Jyk7XG59O1xuXG5FbnVtZXJhdG9yLnByb3RvdHlwZS5fZW51bWVyYXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGg7XG4gIHZhciBfaW5wdXQgPSB0aGlzLl9pbnB1dDtcblxuICBmb3IgKHZhciBpID0gMDsgdGhpcy5fc3RhdGUgPT09IFBFTkRJTkcgJiYgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy5fZWFjaEVudHJ5KF9pbnB1dFtpXSwgaSk7XG4gIH1cbn07XG5cbkVudW1lcmF0b3IucHJvdG90eXBlLl9lYWNoRW50cnkgPSBmdW5jdGlvbiAoZW50cnksIGkpIHtcbiAgdmFyIGMgPSB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yO1xuICB2YXIgcmVzb2x2ZSQkID0gYy5yZXNvbHZlO1xuXG4gIGlmIChyZXNvbHZlJCQgPT09IHJlc29sdmUpIHtcbiAgICB2YXIgX3RoZW4gPSBnZXRUaGVuKGVudHJ5KTtcblxuICAgIGlmIChfdGhlbiA9PT0gdGhlbiAmJiBlbnRyeS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICAgIHRoaXMuX3NldHRsZWRBdChlbnRyeS5fc3RhdGUsIGksIGVudHJ5Ll9yZXN1bHQpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIF90aGVuICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLl9yZW1haW5pbmctLTtcbiAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IGVudHJ5O1xuICAgIH0gZWxzZSBpZiAoYyA9PT0gUHJvbWlzZSkge1xuICAgICAgdmFyIHByb21pc2UgPSBuZXcgYyhub29wKTtcbiAgICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgZW50cnksIF90aGVuKTtcbiAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChwcm9taXNlLCBpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KG5ldyBjKGZ1bmN0aW9uIChyZXNvbHZlJCQpIHtcbiAgICAgICAgcmV0dXJuIHJlc29sdmUkJChlbnRyeSk7XG4gICAgICB9KSwgaSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMuX3dpbGxTZXR0bGVBdChyZXNvbHZlJCQoZW50cnkpLCBpKTtcbiAgfVxufTtcblxuRW51bWVyYXRvci5wcm90b3R5cGUuX3NldHRsZWRBdCA9IGZ1bmN0aW9uIChzdGF0ZSwgaSwgdmFsdWUpIHtcbiAgdmFyIHByb21pc2UgPSB0aGlzLnByb21pc2U7XG5cbiAgaWYgKHByb21pc2UuX3N0YXRlID09PSBQRU5ESU5HKSB7XG4gICAgdGhpcy5fcmVtYWluaW5nLS07XG5cbiAgICBpZiAoc3RhdGUgPT09IFJFSkVDVEVEKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcmVzdWx0W2ldID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgIGZ1bGZpbGwocHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgfVxufTtcblxuRW51bWVyYXRvci5wcm90b3R5cGUuX3dpbGxTZXR0bGVBdCA9IGZ1bmN0aW9uIChwcm9taXNlLCBpKSB7XG4gIHZhciBlbnVtZXJhdG9yID0gdGhpcztcblxuICBzdWJzY3JpYmUocHJvbWlzZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KEZVTEZJTExFRCwgaSwgdmFsdWUpO1xuICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChSRUpFQ1RFRCwgaSwgcmVhc29uKTtcbiAgfSk7XG59O1xuXG4vKipcbiAgYFByb21pc2UuYWxsYCBhY2NlcHRzIGFuIGFycmF5IG9mIHByb21pc2VzLCBhbmQgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoXG4gIGlzIGZ1bGZpbGxlZCB3aXRoIGFuIGFycmF5IG9mIGZ1bGZpbGxtZW50IHZhbHVlcyBmb3IgdGhlIHBhc3NlZCBwcm9taXNlcywgb3JcbiAgcmVqZWN0ZWQgd2l0aCB0aGUgcmVhc29uIG9mIHRoZSBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBiZSByZWplY3RlZC4gSXQgY2FzdHMgYWxsXG4gIGVsZW1lbnRzIG9mIHRoZSBwYXNzZWQgaXRlcmFibGUgdG8gcHJvbWlzZXMgYXMgaXQgcnVucyB0aGlzIGFsZ29yaXRobS5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcbiAgbGV0IHByb21pc2UyID0gcmVzb2x2ZSgyKTtcbiAgbGV0IHByb21pc2UzID0gcmVzb2x2ZSgzKTtcbiAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIFRoZSBhcnJheSBoZXJlIHdvdWxkIGJlIFsgMSwgMiwgMyBdO1xuICB9KTtcbiAgYGBgXG5cbiAgSWYgYW55IG9mIHRoZSBgcHJvbWlzZXNgIGdpdmVuIHRvIGBhbGxgIGFyZSByZWplY3RlZCwgdGhlIGZpcnN0IHByb21pc2VcbiAgdGhhdCBpcyByZWplY3RlZCB3aWxsIGJlIGdpdmVuIGFzIGFuIGFyZ3VtZW50IHRvIHRoZSByZXR1cm5lZCBwcm9taXNlcydzXG4gIHJlamVjdGlvbiBoYW5kbGVyLiBGb3IgZXhhbXBsZTpcblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gcmVzb2x2ZSgxKTtcbiAgbGV0IHByb21pc2UyID0gcmVqZWN0KG5ldyBFcnJvcihcIjJcIikpO1xuICBsZXQgcHJvbWlzZTMgPSByZWplY3QobmV3IEVycm9yKFwiM1wiKSk7XG4gIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVucyBiZWNhdXNlIHRoZXJlIGFyZSByZWplY3RlZCBwcm9taXNlcyFcbiAgfSwgZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAvLyBlcnJvci5tZXNzYWdlID09PSBcIjJcIlxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCBhbGxcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FycmF5fSBlbnRyaWVzIGFycmF5IG9mIHByb21pc2VzXG4gIEBwYXJhbSB7U3RyaW5nfSBsYWJlbCBvcHRpb25hbCBzdHJpbmcgZm9yIGxhYmVsaW5nIHRoZSBwcm9taXNlLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2UgdGhhdCBpcyBmdWxmaWxsZWQgd2hlbiBhbGwgYHByb21pc2VzYCBoYXZlIGJlZW5cbiAgZnVsZmlsbGVkLCBvciByZWplY3RlZCBpZiBhbnkgb2YgdGhlbSBiZWNvbWUgcmVqZWN0ZWQuXG4gIEBzdGF0aWNcbiovXG5mdW5jdGlvbiBhbGwoZW50cmllcykge1xuICByZXR1cm4gbmV3IEVudW1lcmF0b3IodGhpcywgZW50cmllcykucHJvbWlzZTtcbn1cblxuLyoqXG4gIGBQcm9taXNlLnJhY2VgIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaCBpcyBzZXR0bGVkIGluIHRoZSBzYW1lIHdheSBhcyB0aGVcbiAgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gc2V0dGxlLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAyJyk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gcmVzdWx0ID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIGl0IHdhcyByZXNvbHZlZCBiZWZvcmUgcHJvbWlzZTFcbiAgICAvLyB3YXMgcmVzb2x2ZWQuXG4gIH0pO1xuICBgYGBcblxuICBgUHJvbWlzZS5yYWNlYCBpcyBkZXRlcm1pbmlzdGljIGluIHRoYXQgb25seSB0aGUgc3RhdGUgb2YgdGhlIGZpcnN0XG4gIHNldHRsZWQgcHJvbWlzZSBtYXR0ZXJzLiBGb3IgZXhhbXBsZSwgZXZlbiBpZiBvdGhlciBwcm9taXNlcyBnaXZlbiB0byB0aGVcbiAgYHByb21pc2VzYCBhcnJheSBhcmd1bWVudCBhcmUgcmVzb2x2ZWQsIGJ1dCB0aGUgZmlyc3Qgc2V0dGxlZCBwcm9taXNlIGhhc1xuICBiZWNvbWUgcmVqZWN0ZWQgYmVmb3JlIHRoZSBvdGhlciBwcm9taXNlcyBiZWNhbWUgZnVsZmlsbGVkLCB0aGUgcmV0dXJuZWRcbiAgcHJvbWlzZSB3aWxsIGJlY29tZSByZWplY3RlZDpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZWplY3QobmV3IEVycm9yKCdwcm9taXNlIDInKSk7XG4gICAgfSwgMTAwKTtcbiAgfSk7XG5cbiAgUHJvbWlzZS5yYWNlKFtwcm9taXNlMSwgcHJvbWlzZTJdKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnNcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBwcm9taXNlIDIgYmVjYW1lIHJlamVjdGVkIGJlZm9yZVxuICAgIC8vIHByb21pc2UgMSBiZWNhbWUgZnVsZmlsbGVkXG4gIH0pO1xuICBgYGBcblxuICBBbiBleGFtcGxlIHJlYWwtd29ybGQgdXNlIGNhc2UgaXMgaW1wbGVtZW50aW5nIHRpbWVvdXRzOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgUHJvbWlzZS5yYWNlKFthamF4KCdmb28uanNvbicpLCB0aW1lb3V0KDUwMDApXSlcbiAgYGBgXG5cbiAgQG1ldGhvZCByYWNlXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXMgdG8gb2JzZXJ2ZVxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSB3aGljaCBzZXR0bGVzIGluIHRoZSBzYW1lIHdheSBhcyB0aGUgZmlyc3QgcGFzc2VkXG4gIHByb21pc2UgdG8gc2V0dGxlLlxuKi9cbmZ1bmN0aW9uIHJhY2UoZW50cmllcykge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gIGlmICghaXNBcnJheShlbnRyaWVzKSkge1xuICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKF8sIHJlamVjdCkge1xuICAgICAgcmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGFycmF5IHRvIHJhY2UuJykpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgQ29uc3RydWN0b3IoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIGxlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBDb25zdHJ1Y3Rvci5yZXNvbHZlKGVudHJpZXNbaV0pLnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAgYFByb21pc2UucmVqZWN0YCByZXR1cm5zIGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBwYXNzZWQgYHJlYXNvbmAuXG4gIEl0IGlzIHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSl7XG4gICAgLy8gQ29kZSBoZXJlIGRvZXNuJ3QgcnVuIGJlY2F1c2UgdGhlIHByb21pc2UgaXMgcmVqZWN0ZWQhXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdXSE9PUFMnXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlamVjdFxuICBAc3RhdGljXG4gIEBwYXJhbSB7QW55fSByZWFzb24gdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlamVjdGVkIHdpdGguXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIGdpdmVuIGByZWFzb25gLlxuKi9cbmZ1bmN0aW9uIHJlamVjdChyZWFzb24pIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcbiAgdmFyIHByb21pc2UgPSBuZXcgQ29uc3RydWN0b3Iobm9vcCk7XG4gIF9yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbmZ1bmN0aW9uIG5lZWRzUmVzb2x2ZXIoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYSByZXNvbHZlciBmdW5jdGlvbiBhcyB0aGUgZmlyc3QgYXJndW1lbnQgdG8gdGhlIHByb21pc2UgY29uc3RydWN0b3InKTtcbn1cblxuZnVuY3Rpb24gbmVlZHNOZXcoKSB7XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoXCJGYWlsZWQgdG8gY29uc3RydWN0ICdQcm9taXNlJzogUGxlYXNlIHVzZSB0aGUgJ25ldycgb3BlcmF0b3IsIHRoaXMgb2JqZWN0IGNvbnN0cnVjdG9yIGNhbm5vdCBiZSBjYWxsZWQgYXMgYSBmdW5jdGlvbi5cIik7XG59XG5cbi8qKlxuICBQcm9taXNlIG9iamVjdHMgcmVwcmVzZW50IHRoZSBldmVudHVhbCByZXN1bHQgb2YgYW4gYXN5bmNocm9ub3VzIG9wZXJhdGlvbi4gVGhlXG4gIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsIHdoaWNoXG4gIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlIHJlYXNvblxuICB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cblxuICBUZXJtaW5vbG9neVxuICAtLS0tLS0tLS0tLVxuXG4gIC0gYHByb21pc2VgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB3aXRoIGEgYHRoZW5gIG1ldGhvZCB3aG9zZSBiZWhhdmlvciBjb25mb3JtcyB0byB0aGlzIHNwZWNpZmljYXRpb24uXG4gIC0gYHRoZW5hYmxlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gdGhhdCBkZWZpbmVzIGEgYHRoZW5gIG1ldGhvZC5cbiAgLSBgdmFsdWVgIGlzIGFueSBsZWdhbCBKYXZhU2NyaXB0IHZhbHVlIChpbmNsdWRpbmcgdW5kZWZpbmVkLCBhIHRoZW5hYmxlLCBvciBhIHByb21pc2UpLlxuICAtIGBleGNlcHRpb25gIGlzIGEgdmFsdWUgdGhhdCBpcyB0aHJvd24gdXNpbmcgdGhlIHRocm93IHN0YXRlbWVudC5cbiAgLSBgcmVhc29uYCBpcyBhIHZhbHVlIHRoYXQgaW5kaWNhdGVzIHdoeSBhIHByb21pc2Ugd2FzIHJlamVjdGVkLlxuICAtIGBzZXR0bGVkYCB0aGUgZmluYWwgcmVzdGluZyBzdGF0ZSBvZiBhIHByb21pc2UsIGZ1bGZpbGxlZCBvciByZWplY3RlZC5cblxuICBBIHByb21pc2UgY2FuIGJlIGluIG9uZSBvZiB0aHJlZSBzdGF0ZXM6IHBlbmRpbmcsIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQuXG5cbiAgUHJvbWlzZXMgdGhhdCBhcmUgZnVsZmlsbGVkIGhhdmUgYSBmdWxmaWxsbWVudCB2YWx1ZSBhbmQgYXJlIGluIHRoZSBmdWxmaWxsZWRcbiAgc3RhdGUuICBQcm9taXNlcyB0aGF0IGFyZSByZWplY3RlZCBoYXZlIGEgcmVqZWN0aW9uIHJlYXNvbiBhbmQgYXJlIGluIHRoZVxuICByZWplY3RlZCBzdGF0ZS4gIEEgZnVsZmlsbG1lbnQgdmFsdWUgaXMgbmV2ZXIgYSB0aGVuYWJsZS5cblxuICBQcm9taXNlcyBjYW4gYWxzbyBiZSBzYWlkIHRvICpyZXNvbHZlKiBhIHZhbHVlLiAgSWYgdGhpcyB2YWx1ZSBpcyBhbHNvIGFcbiAgcHJvbWlzZSwgdGhlbiB0aGUgb3JpZ2luYWwgcHJvbWlzZSdzIHNldHRsZWQgc3RhdGUgd2lsbCBtYXRjaCB0aGUgdmFsdWUnc1xuICBzZXR0bGVkIHN0YXRlLiAgU28gYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCByZWplY3RzIHdpbGxcbiAgaXRzZWxmIHJlamVjdCwgYW5kIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgZnVsZmlsbHMgd2lsbFxuICBpdHNlbGYgZnVsZmlsbC5cblxuXG4gIEJhc2ljIFVzYWdlOlxuICAtLS0tLS0tLS0tLS1cblxuICBgYGBqc1xuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgIC8vIG9uIHN1Y2Nlc3NcbiAgICByZXNvbHZlKHZhbHVlKTtcblxuICAgIC8vIG9uIGZhaWx1cmVcbiAgICByZWplY3QocmVhc29uKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgLy8gb24gcmVqZWN0aW9uXG4gIH0pO1xuICBgYGBcblxuICBBZHZhbmNlZCBVc2FnZTpcbiAgLS0tLS0tLS0tLS0tLS0tXG5cbiAgUHJvbWlzZXMgc2hpbmUgd2hlbiBhYnN0cmFjdGluZyBhd2F5IGFzeW5jaHJvbm91cyBpbnRlcmFjdGlvbnMgc3VjaCBhc1xuICBgWE1MSHR0cFJlcXVlc3Rgcy5cblxuICBgYGBqc1xuICBmdW5jdGlvbiBnZXRKU09OKHVybCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgICAgbGV0IHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICB4aHIub3BlbignR0VUJywgdXJsKTtcbiAgICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBoYW5kbGVyO1xuICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdqc29uJztcbiAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdBY2NlcHQnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgeGhyLnNlbmQoKTtcblxuICAgICAgZnVuY3Rpb24gaGFuZGxlcigpIHtcbiAgICAgICAgaWYgKHRoaXMucmVhZHlTdGF0ZSA9PT0gdGhpcy5ET05FKSB7XG4gICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIHJlc29sdmUodGhpcy5yZXNwb25zZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2dldEpTT046IGAnICsgdXJsICsgJ2AgZmFpbGVkIHdpdGggc3RhdHVzOiBbJyArIHRoaXMuc3RhdHVzICsgJ10nKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0SlNPTignL3Bvc3RzLmpzb24nKS50aGVuKGZ1bmN0aW9uKGpzb24pIHtcbiAgICAvLyBvbiBmdWxmaWxsbWVudFxuICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBvbiByZWplY3Rpb25cbiAgfSk7XG4gIGBgYFxuXG4gIFVubGlrZSBjYWxsYmFja3MsIHByb21pc2VzIGFyZSBncmVhdCBjb21wb3NhYmxlIHByaW1pdGl2ZXMuXG5cbiAgYGBganNcbiAgUHJvbWlzZS5hbGwoW1xuICAgIGdldEpTT04oJy9wb3N0cycpLFxuICAgIGdldEpTT04oJy9jb21tZW50cycpXG4gIF0pLnRoZW4oZnVuY3Rpb24odmFsdWVzKXtcbiAgICB2YWx1ZXNbMF0gLy8gPT4gcG9zdHNKU09OXG4gICAgdmFsdWVzWzFdIC8vID0+IGNvbW1lbnRzSlNPTlxuXG4gICAgcmV0dXJuIHZhbHVlcztcbiAgfSk7XG4gIGBgYFxuXG4gIEBjbGFzcyBQcm9taXNlXG4gIEBwYXJhbSB7ZnVuY3Rpb259IHJlc29sdmVyXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQGNvbnN0cnVjdG9yXG4qL1xuZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlcikge1xuICB0aGlzW1BST01JU0VfSURdID0gbmV4dElkKCk7XG4gIHRoaXMuX3Jlc3VsdCA9IHRoaXMuX3N0YXRlID0gdW5kZWZpbmVkO1xuICB0aGlzLl9zdWJzY3JpYmVycyA9IFtdO1xuXG4gIGlmIChub29wICE9PSByZXNvbHZlcikge1xuICAgIHR5cGVvZiByZXNvbHZlciAhPT0gJ2Z1bmN0aW9uJyAmJiBuZWVkc1Jlc29sdmVyKCk7XG4gICAgdGhpcyBpbnN0YW5jZW9mIFByb21pc2UgPyBpbml0aWFsaXplUHJvbWlzZSh0aGlzLCByZXNvbHZlcikgOiBuZWVkc05ldygpO1xuICB9XG59XG5cblByb21pc2UuYWxsID0gYWxsO1xuUHJvbWlzZS5yYWNlID0gcmFjZTtcblByb21pc2UucmVzb2x2ZSA9IHJlc29sdmU7XG5Qcm9taXNlLnJlamVjdCA9IHJlamVjdDtcblByb21pc2UuX3NldFNjaGVkdWxlciA9IHNldFNjaGVkdWxlcjtcblByb21pc2UuX3NldEFzYXAgPSBzZXRBc2FwO1xuUHJvbWlzZS5fYXNhcCA9IGFzYXA7XG5cblByb21pc2UucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogUHJvbWlzZSxcblxuICAvKipcbiAgICBUaGUgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCxcbiAgICB3aGljaCByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZVxuICAgIHJlYXNvbiB3aHkgdGhlIHByb21pc2UgY2Fubm90IGJlIGZ1bGZpbGxlZC5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24odXNlcil7XG4gICAgICAvLyB1c2VyIGlzIGF2YWlsYWJsZVxuICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyB1c2VyIGlzIHVuYXZhaWxhYmxlLCBhbmQgeW91IGFyZSBnaXZlbiB0aGUgcmVhc29uIHdoeVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBDaGFpbmluZ1xuICAgIC0tLS0tLS0tXG4gIFxuICAgIFRoZSByZXR1cm4gdmFsdWUgb2YgYHRoZW5gIGlzIGl0c2VsZiBhIHByb21pc2UuICBUaGlzIHNlY29uZCwgJ2Rvd25zdHJlYW0nXG4gICAgcHJvbWlzZSBpcyByZXNvbHZlZCB3aXRoIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZpcnN0IHByb21pc2UncyBmdWxmaWxsbWVudFxuICAgIG9yIHJlamVjdGlvbiBoYW5kbGVyLCBvciByZWplY3RlZCBpZiB0aGUgaGFuZGxlciB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIHVzZXIubmFtZTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICByZXR1cm4gJ2RlZmF1bHQgbmFtZSc7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodXNlck5hbWUpIHtcbiAgICAgIC8vIElmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgdXNlck5hbWVgIHdpbGwgYmUgdGhlIHVzZXIncyBuYW1lLCBvdGhlcndpc2UgaXRcbiAgICAgIC8vIHdpbGwgYmUgYCdkZWZhdWx0IG5hbWUnYFxuICAgIH0pO1xuICBcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknKTtcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIC8vIGlmIGBmaW5kVXNlcmAgZnVsZmlsbGVkLCBgcmVhc29uYCB3aWxsIGJlICdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScuXG4gICAgICAvLyBJZiBgZmluZFVzZXJgIHJlamVjdGVkLCBgcmVhc29uYCB3aWxsIGJlICdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jy5cbiAgICB9KTtcbiAgICBgYGBcbiAgICBJZiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIGRvZXMgbm90IHNwZWNpZnkgYSByZWplY3Rpb24gaGFuZGxlciwgcmVqZWN0aW9uIHJlYXNvbnMgd2lsbCBiZSBwcm9wYWdhdGVkIGZ1cnRoZXIgZG93bnN0cmVhbS5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHRocm93IG5ldyBQZWRhZ29naWNhbEV4Y2VwdGlvbignVXBzdHJlYW0gZXJyb3InKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLy8gVGhlIGBQZWRnYWdvY2lhbEV4Y2VwdGlvbmAgaXMgcHJvcGFnYXRlZCBhbGwgdGhlIHdheSBkb3duIHRvIGhlcmVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQXNzaW1pbGF0aW9uXG4gICAgLS0tLS0tLS0tLS0tXG4gIFxuICAgIFNvbWV0aW1lcyB0aGUgdmFsdWUgeW91IHdhbnQgdG8gcHJvcGFnYXRlIHRvIGEgZG93bnN0cmVhbSBwcm9taXNlIGNhbiBvbmx5IGJlXG4gICAgcmV0cmlldmVkIGFzeW5jaHJvbm91c2x5LiBUaGlzIGNhbiBiZSBhY2hpZXZlZCBieSByZXR1cm5pbmcgYSBwcm9taXNlIGluIHRoZVxuICAgIGZ1bGZpbGxtZW50IG9yIHJlamVjdGlvbiBoYW5kbGVyLiBUaGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgdGhlbiBiZSBwZW5kaW5nXG4gICAgdW50aWwgdGhlIHJldHVybmVkIHByb21pc2UgaXMgc2V0dGxlZC4gVGhpcyBpcyBjYWxsZWQgKmFzc2ltaWxhdGlvbiouXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgIC8vIFRoZSB1c2VyJ3MgY29tbWVudHMgYXJlIG5vdyBhdmFpbGFibGVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgSWYgdGhlIGFzc2ltbGlhdGVkIHByb21pc2UgcmVqZWN0cywgdGhlbiB0aGUgZG93bnN0cmVhbSBwcm9taXNlIHdpbGwgYWxzbyByZWplY3QuXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICByZXR1cm4gZmluZENvbW1lbnRzQnlBdXRob3IodXNlcik7XG4gICAgfSkudGhlbihmdW5jdGlvbiAoY29tbWVudHMpIHtcbiAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgZnVsZmlsbHMsIHdlJ2xsIGhhdmUgdGhlIHZhbHVlIGhlcmVcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIHJlamVjdHMsIHdlJ2xsIGhhdmUgdGhlIHJlYXNvbiBoZXJlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIFNpbXBsZSBFeGFtcGxlXG4gICAgLS0tLS0tLS0tLS0tLS1cbiAgXG4gICAgU3luY2hyb25vdXMgRXhhbXBsZVxuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgbGV0IHJlc3VsdDtcbiAgXG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IGZpbmRSZXN1bHQoKTtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH1cbiAgICBgYGBcbiAgXG4gICAgRXJyYmFjayBFeGFtcGxlXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFJlc3VsdChmdW5jdGlvbihyZXN1bHQsIGVycil7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH1cbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgUHJvbWlzZSBFeGFtcGxlO1xuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgZmluZFJlc3VsdCgpLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBBZHZhbmNlZCBFeGFtcGxlXG4gICAgLS0tLS0tLS0tLS0tLS1cbiAgXG4gICAgU3luY2hyb25vdXMgRXhhbXBsZVxuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgbGV0IGF1dGhvciwgYm9va3M7XG4gIFxuICAgIHRyeSB7XG4gICAgICBhdXRob3IgPSBmaW5kQXV0aG9yKCk7XG4gICAgICBib29rcyAgPSBmaW5kQm9va3NCeUF1dGhvcihhdXRob3IpO1xuICAgICAgLy8gc3VjY2Vzc1xuICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAvLyBmYWlsdXJlXG4gICAgfVxuICAgIGBgYFxuICBcbiAgICBFcnJiYWNrIEV4YW1wbGVcbiAgXG4gICAgYGBganNcbiAgXG4gICAgZnVuY3Rpb24gZm91bmRCb29rcyhib29rcykge1xuICBcbiAgICB9XG4gIFxuICAgIGZ1bmN0aW9uIGZhaWx1cmUocmVhc29uKSB7XG4gIFxuICAgIH1cbiAgXG4gICAgZmluZEF1dGhvcihmdW5jdGlvbihhdXRob3IsIGVycil7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmaW5kQm9vb2tzQnlBdXRob3IoYXV0aG9yLCBmdW5jdGlvbihib29rcywgZXJyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm91bmRCb29rcyhib29rcyk7XG4gICAgICAgICAgICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAgICAgICAgICAgZmFpbHVyZShyZWFzb24pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBQcm9taXNlIEV4YW1wbGU7XG4gIFxuICAgIGBgYGphdmFzY3JpcHRcbiAgICBmaW5kQXV0aG9yKCkuXG4gICAgICB0aGVuKGZpbmRCb29rc0J5QXV0aG9yKS5cbiAgICAgIHRoZW4oZnVuY3Rpb24oYm9va3Mpe1xuICAgICAgICAvLyBmb3VuZCBib29rc1xuICAgIH0pLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBAbWV0aG9kIHRoZW5cbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvbkZ1bGZpbGxlZFxuICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0ZWRcbiAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cbiAgdGhlbjogdGhlbixcblxuICAvKipcbiAgICBgY2F0Y2hgIGlzIHNpbXBseSBzdWdhciBmb3IgYHRoZW4odW5kZWZpbmVkLCBvblJlamVjdGlvbilgIHdoaWNoIG1ha2VzIGl0IHRoZSBzYW1lXG4gICAgYXMgdGhlIGNhdGNoIGJsb2NrIG9mIGEgdHJ5L2NhdGNoIHN0YXRlbWVudC5cbiAgXG4gICAgYGBganNcbiAgICBmdW5jdGlvbiBmaW5kQXV0aG9yKCl7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkbid0IGZpbmQgdGhhdCBhdXRob3InKTtcbiAgICB9XG4gIFxuICAgIC8vIHN5bmNocm9ub3VzXG4gICAgdHJ5IHtcbiAgICAgIGZpbmRBdXRob3IoKTtcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICB9XG4gIFxuICAgIC8vIGFzeW5jIHdpdGggcHJvbWlzZXNcbiAgICBmaW5kQXV0aG9yKCkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEBtZXRob2QgY2F0Y2hcbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGlvblxuICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAqL1xuICAnY2F0Y2gnOiBmdW5jdGlvbiBfY2F0Y2gob25SZWplY3Rpb24pIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKG51bGwsIG9uUmVqZWN0aW9uKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gcG9seWZpbGwoKSB7XG4gICAgdmFyIGxvY2FsID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGxvY2FsID0gZ2xvYmFsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGxvY2FsID0gc2VsZjtcbiAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbG9jYWwgPSBGdW5jdGlvbigncmV0dXJuIHRoaXMnKSgpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvbHlmaWxsIGZhaWxlZCBiZWNhdXNlIGdsb2JhbCBvYmplY3QgaXMgdW5hdmFpbGFibGUgaW4gdGhpcyBlbnZpcm9ubWVudCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIFAgPSBsb2NhbC5Qcm9taXNlO1xuXG4gICAgaWYgKFApIHtcbiAgICAgICAgdmFyIHByb21pc2VUb1N0cmluZyA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcm9taXNlVG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoUC5yZXNvbHZlKCkpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmVkXG4gICAgICAgIH1cblxuICAgICAgICBpZiAocHJvbWlzZVRvU3RyaW5nID09PSAnW29iamVjdCBQcm9taXNlXScgJiYgIVAuY2FzdCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbG9jYWwuUHJvbWlzZSA9IFByb21pc2U7XG59XG5cbnBvbHlmaWxsKCk7XG4vLyBTdHJhbmdlIGNvbXBhdC4uXG5Qcm9taXNlLnBvbHlmaWxsID0gcG9seWZpbGw7XG5Qcm9taXNlLlByb21pc2UgPSBQcm9taXNlO1xuXG5yZXR1cm4gUHJvbWlzZTtcblxufSkpKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVzNi1wcm9taXNlLm1hcCIsIi8qISBGaWxlU2F2ZXIuanMgdjEuMy42XG4gKlxuICogQSBzYXZlQXMoKSBGaWxlU2F2ZXIgaW1wbGVtZW50YXRpb24uXG4gKlxuICogQnkgVHJhdmlzIENsYXJrZSwgaHR0cHM6Ly90cmF2aXNtY2xhcmtlLmNvbVxuICogQnkgRWxpIEdyZXksIGh0dHA6Ly9lbGlncmV5LmNvbVxuICpcbiAqIExpY2Vuc2U6IE1JVCAoaHR0cHM6Ly9naXRodWIuY29tL2NsYXJrZXRtL0ZpbGVTYXZlci5qcy9ibG9iL21hc3Rlci9MSUNFTlNFLm1kKVxuICovXG5cbjsoZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICYmIHR5cGVvZiBleHBvcnRzLm5vZGVOYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IHJvb3QuZG9jdW1lbnQgPyBmYWN0b3J5KHJvb3QsIHRydWUpIDogZnVuY3Rpb24gKHcpIHtcbiAgICAgICAgICAgIGlmICghdy5kb2N1bWVudCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkZpbGVTYXZlciByZXF1aXJlcyBhIHdpbmRvdyB3aXRoIGEgZG9jdW1lbnRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFjdG9yeSh3KTtcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBmYWN0b3J5KHJvb3QpO1xuICAgIH1cbn0od2luZG93IHx8IHRoaXMsIGZ1bmN0aW9uICh3aW5kb3csIG5vR2xvYmFsKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuICAgICAgICAvLyBJRSA8MTAgaXMgZXhwbGljaXRseSB1bnN1cHBvcnRlZFxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gXCJ1bmRlZmluZWRcIiB8fCB0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIC9NU0lFIFsxLTldXFwuLy50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyXG4gICAgICAgICAgICBkb2MgPSB3aW5kb3cuZG9jdW1lbnRcbiAgICAgICAgICAgIC8vIG9ubHkgZ2V0IFVSTCB3aGVuIG5lY2Vzc2FyeSBpbiBjYXNlIEJsb2IuanMgaGFzbid0IG92ZXJyaWRkZW4gaXQgeWV0XG4gICAgICAgICAgICAsIGdldF9VUkwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTCB8fCB3aW5kb3c7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIHNhdmVfbGluayA9IGRvYy5jcmVhdGVFbGVtZW50TlMoXCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hodG1sXCIsIFwiYVwiKVxuICAgICAgICAgICAgLCBjYW5fdXNlX3NhdmVfbGluayA9IFwiZG93bmxvYWRcIiBpbiBzYXZlX2xpbmtcbiAgICAgICAgICAgICwgY2xpY2sgPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIHZhciBldmVudCA9IG5ldyBNb3VzZUV2ZW50KFwiY2xpY2tcIik7XG4gICAgICAgICAgICAgICAgbm9kZS5kaXNwYXRjaEV2ZW50KGV2ZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgaXNfc2FmYXJpID0gL2NvbnN0cnVjdG9yL2kudGVzdCh3aW5kb3cuSFRNTEVsZW1lbnQpIHx8IHdpbmRvdy5zYWZhcmlcbiAgICAgICAgICAgICwgaXNfY2hyb21lX2lvcyA9IC9DcmlPU1xcL1tcXGRdKy8udGVzdChuYXZpZ2F0b3IudXNlckFnZW50KVxuICAgICAgICAgICAgLCB0aHJvd19vdXRzaWRlID0gZnVuY3Rpb24gKGV4KSB7XG4gICAgICAgICAgICAgICAgKHdpbmRvdy5zZXRJbW1lZGlhdGUgfHwgd2luZG93LnNldFRpbWVvdXQpKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgZXg7XG4gICAgICAgICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIGZvcmNlX3NhdmVhYmxlX3R5cGUgPSBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiXG4gICAgICAgICAgICAvLyB0aGUgQmxvYiBBUEkgaXMgZnVuZGFtZW50YWxseSBicm9rZW4gYXMgdGhlcmUgaXMgbm8gXCJkb3dubG9hZGZpbmlzaGVkXCIgZXZlbnQgdG8gc3Vic2NyaWJlIHRvXG4gICAgICAgICAgICAsIGFyYml0cmFyeV9yZXZva2VfdGltZW91dCA9IDEwMDAgKiA0MCAvLyBpbiBtc1xuICAgICAgICAgICAgLCByZXZva2UgPSBmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgICAgICAgICAgIHZhciByZXZva2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGZpbGUgPT09IFwic3RyaW5nXCIpIHsgLy8gZmlsZSBpcyBhbiBvYmplY3QgVVJMXG4gICAgICAgICAgICAgICAgICAgICAgICBnZXRfVVJMKCkucmV2b2tlT2JqZWN0VVJMKGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBmaWxlIGlzIGEgRmlsZVxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChyZXZva2VyLCBhcmJpdHJhcnlfcmV2b2tlX3RpbWVvdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBkaXNwYXRjaCA9IGZ1bmN0aW9uIChmaWxlc2F2ZXIsIGV2ZW50X3R5cGVzLCBldmVudCkge1xuICAgICAgICAgICAgICAgIGV2ZW50X3R5cGVzID0gW10uY29uY2F0KGV2ZW50X3R5cGVzKTtcbiAgICAgICAgICAgICAgICB2YXIgaSA9IGV2ZW50X3R5cGVzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBsaXN0ZW5lciA9IGZpbGVzYXZlcltcIm9uXCIgKyBldmVudF90eXBlc1tpXV07XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaXN0ZW5lci5jYWxsKGZpbGVzYXZlciwgZXZlbnQgfHwgZmlsZXNhdmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3dfb3V0c2lkZShleCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsIGF1dG9fYm9tID0gZnVuY3Rpb24gKGJsb2IpIHtcbiAgICAgICAgICAgICAgICAvLyBwcmVwZW5kIEJPTSBmb3IgVVRGLTggWE1MIGFuZCB0ZXh0LyogdHlwZXMgKGluY2x1ZGluZyBIVE1MKVxuICAgICAgICAgICAgICAgIC8vIG5vdGU6IHlvdXIgYnJvd3NlciB3aWxsIGF1dG9tYXRpY2FsbHkgY29udmVydCBVVEYtMTYgVStGRUZGIHRvIEVGIEJCIEJGXG4gICAgICAgICAgICAgICAgaWYgKC9eXFxzKig/OnRleHRcXC9cXFMqfGFwcGxpY2F0aW9uXFwveG1sfFxcUypcXC9cXFMqXFwreG1sKVxccyo7LipjaGFyc2V0XFxzKj1cXHMqdXRmLTgvaS50ZXN0KGJsb2IudHlwZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBCbG9iKFtTdHJpbmcuZnJvbUNoYXJDb2RlKDB4RkVGRiksIGJsb2JdLCB7dHlwZTogYmxvYi50eXBlfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBibG9iO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLCBGaWxlU2F2ZXIgPSBmdW5jdGlvbiAoYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcbiAgICAgICAgICAgICAgICBpZiAoIW5vX2F1dG9fYm9tKSB7XG4gICAgICAgICAgICAgICAgICAgIGJsb2IgPSBhdXRvX2JvbShibG9iKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gRmlyc3QgdHJ5IGEuZG93bmxvYWQsIHRoZW4gd2ViIGZpbGVzeXN0ZW0sIHRoZW4gb2JqZWN0IFVSTHNcbiAgICAgICAgICAgICAgICB2YXJcbiAgICAgICAgICAgICAgICAgICAgZmlsZXNhdmVyID0gdGhpc1xuICAgICAgICAgICAgICAgICAgICAsIHR5cGUgPSBibG9iLnR5cGVcbiAgICAgICAgICAgICAgICAgICAgLCBmb3JjZSA9IHR5cGUgPT09IGZvcmNlX3NhdmVhYmxlX3R5cGVcbiAgICAgICAgICAgICAgICAgICAgLCBvYmplY3RfdXJsXG4gICAgICAgICAgICAgICAgICAgICwgZGlzcGF0Y2hfYWxsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGF0Y2goZmlsZXNhdmVyLCBcIndyaXRlc3RhcnQgcHJvZ3Jlc3Mgd3JpdGUgd3JpdGVlbmRcIi5zcGxpdChcIiBcIikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIC8vIG9uIGFueSBmaWxlc3lzIGVycm9ycyByZXZlcnQgdG8gc2F2aW5nIHdpdGggb2JqZWN0IFVSTHNcbiAgICAgICAgICAgICAgICAgICAgLCBmc19lcnJvciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgoaXNfY2hyb21lX2lvcyB8fCAoZm9yY2UgJiYgaXNfc2FmYXJpKSkgJiYgd2luZG93LkZpbGVSZWFkZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTYWZhcmkgZG9lc24ndCBhbGxvdyBkb3dubG9hZGluZyBvZiBibG9iIHVybHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkZXIub25sb2FkZW5kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgdXJsID0gaXNfY2hyb21lX2lvcyA/IHJlYWRlci5yZXN1bHQgOiByZWFkZXIucmVzdWx0LnJlcGxhY2UoL15kYXRhOlteO10qOy8sICdkYXRhOmF0dGFjaG1lbnQvZmlsZTsnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHBvcHVwID0gd2luZG93Lm9wZW4odXJsLCAnX2JsYW5rJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcG9wdXApIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gdXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmwgPSB1bmRlZmluZWQ7IC8vIHJlbGVhc2UgcmVmZXJlbmNlIGJlZm9yZSBkaXNwYXRjaGluZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwYXRjaF9hbGwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLklOSVQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZG9uJ3QgY3JlYXRlIG1vcmUgb2JqZWN0IFVSTHMgdGhhbiBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghb2JqZWN0X3VybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdF91cmwgPSBnZXRfVVJMKCkuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZvcmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBvYmplY3RfdXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb3BlbmVkID0gd2luZG93Lm9wZW4ob2JqZWN0X3VybCwgXCJfYmxhbmtcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFvcGVuZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQXBwbGUgZG9lcyBub3QgYWxsb3cgd2luZG93Lm9wZW4sIHNlZSBodHRwczovL2RldmVsb3Blci5hcHBsZS5jb20vbGlicmFyeS9zYWZhcmkvZG9jdW1lbnRhdGlvbi9Ub29scy9Db25jZXB0dWFsL1NhZmFyaUV4dGVuc2lvbkd1aWRlL1dvcmtpbmd3aXRoV2luZG93c2FuZFRhYnMvV29ya2luZ3dpdGhXaW5kb3dzYW5kVGFicy5odG1sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5ocmVmID0gb2JqZWN0X3VybDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlc2F2ZXIucmVhZHlTdGF0ZSA9IGZpbGVzYXZlci5ET05FO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGF0Y2hfYWxsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXZva2Uob2JqZWN0X3VybCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgO1xuICAgICAgICAgICAgICAgIGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLklOSVQ7XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FuX3VzZV9zYXZlX2xpbmspIHtcbiAgICAgICAgICAgICAgICAgICAgb2JqZWN0X3VybCA9IGdldF9VUkwoKS5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2F2ZV9saW5rLmhyZWYgPSBvYmplY3RfdXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2F2ZV9saW5rLmRvd25sb2FkID0gbmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsaWNrKHNhdmVfbGluayk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkaXNwYXRjaF9hbGwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldm9rZShvYmplY3RfdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzYXZlci5yZWFkeVN0YXRlID0gZmlsZXNhdmVyLkRPTkU7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZnNfZXJyb3IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICwgRlNfcHJvdG8gPSBGaWxlU2F2ZXIucHJvdG90eXBlXG4gICAgICAgICAgICAsIHNhdmVBcyA9IGZ1bmN0aW9uIChibG9iLCBuYW1lLCBub19hdXRvX2JvbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgRmlsZVNhdmVyKGJsb2IsIG5hbWUgfHwgYmxvYi5uYW1lIHx8IFwiZG93bmxvYWRcIiwgbm9fYXV0b19ib20pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgO1xuICAgICAgICAvLyBJRSAxMCsgKG5hdGl2ZSBzYXZlQXMpXG4gICAgICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSBcInVuZGVmaW5lZFwiICYmIG5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSB7XG4gICAgICAgICAgICBzYXZlQXMgPSBmdW5jdGlvbiAoYmxvYiwgbmFtZSwgbm9fYXV0b19ib20pIHtcbiAgICAgICAgICAgICAgICBuYW1lID0gbmFtZSB8fCBibG9iLm5hbWUgfHwgXCJkb3dubG9hZFwiO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFub19hdXRvX2JvbSkge1xuICAgICAgICAgICAgICAgICAgICBibG9iID0gYXV0b19ib20oYmxvYik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBuYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYihibG9iLCBuYW1lKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBGU19wcm90by5hYm9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgfTtcbiAgICAgICAgRlNfcHJvdG8ucmVhZHlTdGF0ZSA9IEZTX3Byb3RvLklOSVQgPSAwO1xuICAgICAgICBGU19wcm90by5XUklUSU5HID0gMTtcbiAgICAgICAgRlNfcHJvdG8uRE9ORSA9IDI7XG5cbiAgICAgICAgRlNfcHJvdG8uZXJyb3IgPVxuICAgICAgICAgICAgRlNfcHJvdG8ub253cml0ZXN0YXJ0ID1cbiAgICAgICAgICAgICAgICBGU19wcm90by5vbnByb2dyZXNzID1cbiAgICAgICAgICAgICAgICAgICAgRlNfcHJvdG8ub253cml0ZSA9XG4gICAgICAgICAgICAgICAgICAgICAgICBGU19wcm90by5vbmFib3J0ID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBGU19wcm90by5vbmVycm9yID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRlNfcHJvdG8ub253cml0ZWVuZCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAgICAgZGVmaW5lKFwiZmlsZS1zYXZlcmpzXCIsIFtdLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNhdmVBcztcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBub0dsb2JhbCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHdpbmRvdy5zYXZlQXMgPSBzYXZlQXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNhdmVBcztcbiAgICB9XG4pKTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIhZnVuY3Rpb24oZSl7aWYoXCJvYmplY3RcIj09dHlwZW9mIGV4cG9ydHMmJlwidW5kZWZpbmVkXCIhPXR5cGVvZiBtb2R1bGUpbW9kdWxlLmV4cG9ydHM9ZSgpO2Vsc2UgaWYoXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKWRlZmluZShbXSxlKTtlbHNle3ZhciB0O3Q9XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHdpbmRvdz93aW5kb3c6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIGdsb2JhbD9nbG9iYWw6XCJ1bmRlZmluZWRcIiE9dHlwZW9mIHNlbGY/c2VsZjp0aGlzLHQuVFFHcmFtVUk9ZSgpfX0oZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24oKXtmdW5jdGlvbiBlKHQsbixvKXtmdW5jdGlvbiBpKGwsYSl7aWYoIW5bbF0pe2lmKCF0W2xdKXt2YXIgcz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFhJiZzKXJldHVybiBzKGwsITApO2lmKHIpcmV0dXJuIHIobCwhMCk7dmFyIHU9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitsK1wiJ1wiKTt0aHJvdyB1LmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsdX12YXIgZD1uW2xdPXtleHBvcnRzOnt9fTt0W2xdWzBdLmNhbGwoZC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbbF1bMV1bZV07cmV0dXJuIGkobj9uOmUpfSxkLGQuZXhwb3J0cyxlLHQsbixvKX1yZXR1cm4gbltsXS5leHBvcnRzfWZvcih2YXIgcj1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGw9MDtsPG8ubGVuZ3RoO2wrKylpKG9bbF0pO3JldHVybiBpfXJldHVybiBlfSgpKHsxOltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtmdW5jdGlvbiB0KCl7ci5yb290SHRtbC5pbm5lckhUTUw9XCJcIixyLnJvb3RIdG1sLnN0eWxlLmJvcmRlclRvcD0wIT09ci5idXR0b25zLmxlbmd0aD9cIjFweCBzb2xpZCAjY2NjY2NjXCI6bnVsbCxyLnJvb3RIdG1sLnN0eWxlLmJvcmRlckJvdHRvbT0wIT09ci5idXR0b25zLmxlbmd0aD9cIjFweCBzb2xpZCAjY2NjY2NjXCI6bnVsbCxyLmJ1dHRvbnMuZm9yRWFjaChmdW5jdGlvbihlKXt2YXIgdD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiQlVUVE9OXCIpO3QudGl0bGU9ZS5sYWJlbCx0LmNsYXNzTmFtZT1cInRxLXVpLXRvb2xiYXJfX2J1dHRvbiB0cS11aS1jb2xvcmVkLWJ1dHRvblwiLHQuaW5uZXJIVE1MPSc8c3BhbiBzdHlsZT1cImNvbG9yOiAnK2UuYm9yZGVyQ29sb3IrJ1wiPicrbihlLmxhYmVsKStcIjwvc3Bhbj5cIix0LnN0eWxlLmJhY2tncm91bmRDb2xvcj1lLmJhY2tncm91bmRDb2xvcnx8XCJ3aGl0ZVwiLHQuc3R5bGUuYm9yZGVyQ29sb3I9ZS5ib3JkZXJDb2xvcnx8XCJibGFja1wiLHQub25jbGljaz1mdW5jdGlvbih0KXtlLmNhbGxiYWNrKGUsdCl9LHIucm9vdEh0bWwuYXBwZW5kQ2hpbGQodCl9KX1mdW5jdGlvbiBuKGUpe2lmKGUpe3ZhciB0PWUubWF0Y2goL1thLXonXFwtXSsvZ2kpO3JldHVybiB0LmZpbHRlcihmdW5jdGlvbihlKXtyZXR1cm5cImFuZFwiIT09ZS50b0xvd2VyQ2FzZSgpJiZcIiZcIiE9PWV9KS5tYXAoZnVuY3Rpb24oZSl7cmV0dXJuIGVbMF19KS5qb2luKFwiXCIpfX1mdW5jdGlvbiBvKCl7dmFyIGU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIkRJVlwiKTtyZXR1cm4gZS5jbGFzc05hbWU9XCJ0cS11aS1jb2xvcmVkLWJ1dHRvbnMtbGlzdFwiLGUuaW5uZXJIVE1MPVwiXCIsZX12YXIgcj10aGlzO2V8fChlPXt9KSxyLnJvb3RIdG1sPW8oKSxyLmlkPWUuaWR8fFwiY29sb3JlZEJ1dHRvbnMtXCIraSsrLHIucm9vdEh0bWwuaWQ9ci5pZCxyLmJ1dHRvbnM9ZS5idXR0b25zfHxbXSx0KCksci5yZW1vdmVBbGw9ZnVuY3Rpb24oKXtyLmJ1dHRvbnM9W10sdCgpfSxyLmFkZEJ1dHRvbj1mdW5jdGlvbihlKXtyLmJ1dHRvbnMubWFwKGZ1bmN0aW9uKGUpe3JldHVybiBlLmlkfSkuaW5kZXhPZihlLmlkKT09PS0xJiYoci5idXR0b25zLnB1c2goZSksdCgpKX0sci5yZW1vdmVCdXR0b249ZnVuY3Rpb24oZSl7ci5idXR0b25zLnNwbGljZShyLmJ1dHRvbnMuaW5kZXhPZihlKSwxKSx0KCl9fU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pLG4uQ29sb3JlZEJ1dHRvbnNMaXN0PW87dmFyIGk9MDtuW1wiZGVmYXVsdFwiXT1vfSx7fV0sMjpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7cmV0dXJuIGUmJmUuX19lc01vZHVsZT9lOntcImRlZmF1bHRcIjplfX1mdW5jdGlvbiBpKGUpe2Z1bmN0aW9uIHQoKXtpZihlLmJvZHkgaW5zdGFuY2VvZiBPYmplY3Qpe3ZhciB0PWkucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIi50cS11aS1ib2R5X2NvbnRhaW5lclwiKTt0LmFwcGVuZENoaWxkKGUuYm9keS5yb290SHRtbCl9dmFyIGE9aS5yb290SHRtbC5xdWVyeVNlbGVjdG9yKFwiLnRxLXVpLWZseWluZy1wYW5lbF9oZWFkZXJcIik7YS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsbyk7dmFyIHM9aS5yb290SHRtbC5xdWVyeVNlbGVjdG9yKFwiLnRxLXVpLXdpbmRvd3MtY29sbGFwc2UtYnV0dG9uXCIpO2lmKHMub25jbGljaz1pLmhpZGUsZS5yZXNpemFibGUpe3ZhciB1PWkucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIi50cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlci50cS11aS10b3AtYm9yZGVyXCIpO3UuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLGZ1bmN0aW9uKGUpe28oZSxcIm5cIil9KTt2YXIgZD1pLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIudHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIudHEtdWktcmlnaHQtYm9yZGVyXCIpO2QuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLGZ1bmN0aW9uKGUpe28oZSxcImVcIil9KTt2YXIgYz1pLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIudHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIudHEtdWktYm90dG9tLWJvcmRlclwiKTtjLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIixmdW5jdGlvbihlKXtvKGUsXCJzXCIpfSk7dmFyIGY9aS5yb290SHRtbC5xdWVyeVNlbGVjdG9yKFwiLnRxLXVpLWZseWluZy1wYW5lbF9fYm9yZGVyLnRxLXVpLWxlZnQtYm9yZGVyXCIpO2YuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLGZ1bmN0aW9uKGUpe28oZSxcIndcIil9KTt2YXIgcD1pLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIudHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIudHEtdWktdG9wLXJpZ2h0LWJvcmRlclwiKTtwLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIixmdW5jdGlvbihlKXtvKGUsXCJuZVwiKX0pO3ZhciBiPWkucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIi50cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlci50cS11aS10b3AtbGVmdC1ib3JkZXJcIik7Yi5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsZnVuY3Rpb24oZSl7byhlLFwibndcIil9KTt2YXIgbT1pLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIudHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIudHEtdWktYm90dG9tLXJpZ2h0LWJvcmRlclwiKTttLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIixmdW5jdGlvbihlKXtvKGUsXCJzZVwiKX0pO3ZhciB5PWkucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIi50cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlci50cS11aS1ib3R0b20tbGVmdC1ib3JkZXJcIik7eS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsZnVuY3Rpb24oZSl7byhlLFwic3dcIil9KX1pLl90cmlnZ2VyQnV0dG9uPXIoZS50cmlnZ2VyQnV0dG9uKSxuKCksaS5fdHJpZ2dlckJ1dHRvbiYmKGkuX3RyaWdnZXJCdXR0b24ub25jbGljaz1mdW5jdGlvbigpe2w/aS5zaG93KCk6aS5oaWRlKCl9KX1mdW5jdGlvbiBuKCl7bD8oaS5fdHJpZ2dlckJ1dHRvbiYmKGkuX3RyaWdnZXJCdXR0b24uY2xhc3NOYW1lPWkuX3RyaWdnZXJCdXR0b24uY2xhc3NOYW1lLnJlcGxhY2UoLyB0cS11aS1zZWxlY3RlZC9naSxcIlwiKSksaS5yb290SHRtbC5jbGFzc05hbWU9aS5yb290SHRtbC5jbGFzc05hbWUrXCIgdHEtdWktY29sbGFwc2VkXCIpOihpLl90cmlnZ2VyQnV0dG9uJiYoaS5fdHJpZ2dlckJ1dHRvbi5jbGFzc05hbWU9aS5fdHJpZ2dlckJ1dHRvbi5jbGFzc05hbWUrXCIgdHEtdWktc2VsZWN0ZWRcIiksaS5yb290SHRtbC5jbGFzc05hbWU9aS5yb290SHRtbC5jbGFzc05hbWUucmVwbGFjZSgvIHRxLXVpLWNvbGxhcHNlZC9naSxcIlwiKSl9ZnVuY3Rpb24gbyhlLHQpe2Z1bmN0aW9uIG4oZSl7aS5fbW91c2VNb3ZlPSEwO3ZhciBuPTA7ZS5wYWdlWD9uPWUucGFnZVg6ZS5jbGllbnRYJiYobj1lLmNsaWVudFgpO3ZhciBvPW4tbDtsPW4sdHx8KGkucm9vdEh0bWwuc3R5bGUubGVmdD1pLnJvb3RIdG1sLm9mZnNldExlZnQrbytcInB4XCIpO3ZhciBzPTA7ZS5wYWdlWT9zPWUucGFnZVk6ZS5jbGllbnRZJiYocz1lLmNsaWVudFkpO3ZhciB1PXMtYTthPXMsdHx8KGkucm9vdEh0bWwuc3R5bGUudG9wPWkucm9vdEh0bWwub2Zmc2V0VG9wK3UrXCJweFwiKSx0PyhyKG8sdSx0KSxpLnRyaWdnZXIoXCJzaXplLWNoYW5nZWRcIix7d2lkdGg6aS5yb290SHRtbC5vZmZzZXRXaWR0aCxoZWlnaHQ6aS5yb290SHRtbC5vZmZzZXRIZWlnaHR9KSx0LmluZGV4T2YoXCJuXCIpPT09LTEmJnQuaW5kZXhPZihcIndcIik9PT0tMXx8aS50cmlnZ2VyKFwicG9zaXRpb24tY2hhbmdlZFwiLHt4Omkucm9vdEh0bWwub2Zmc2V0TGVmdCx5Omkucm9vdEh0bWwub2Zmc2V0VG9wfSkpOmkudHJpZ2dlcihcInBvc2l0aW9uLWNoYW5nZWRcIix7eDppLnJvb3RIdG1sLm9mZnNldExlZnQseTppLnJvb3RIdG1sLm9mZnNldFRvcH0pfWZ1bmN0aW9uIG8oZSl7aS5fbW91c2VNb3ZlJiYobihlLCEwKSxpLl9tb3VzZU1vdmU9ITEpLGRvY3VtZW50LmJvZHkub25tb3VzZW1vdmU9ZG9jdW1lbnQuYm9keS5vbm1vdXNldXA9bnVsbCxkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIixuKSxkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsbyl9ZnVuY3Rpb24gcihlLHQsbil7c3dpdGNoKG4pe2Nhc2VcIm5cIjppLnJvb3RIdG1sLnN0eWxlLmhlaWdodD1pLnJvb3RIdG1sLm9mZnNldEhlaWdodC10K1wicHhcIixpLnJvb3RIdG1sLnN0eWxlLnRvcD1pLnJvb3RIdG1sLm9mZnNldFRvcCt0K1wicHhcIjticmVhaztjYXNlXCJlXCI6aS5yb290SHRtbC5zdHlsZS53aWR0aD1pLnJvb3RIdG1sLm9mZnNldFdpZHRoK2UrXCJweFwiO2JyZWFrO2Nhc2VcInNcIjppLnJvb3RIdG1sLnN0eWxlLmhlaWdodD1pLnJvb3RIdG1sLm9mZnNldEhlaWdodCt0K1wicHhcIjticmVhaztjYXNlXCJ3XCI6aS5yb290SHRtbC5zdHlsZS53aWR0aD1pLnJvb3RIdG1sLm9mZnNldFdpZHRoLWUrXCJweFwiLGkucm9vdEh0bWwuc3R5bGUubGVmdD1pLnJvb3RIdG1sLm9mZnNldExlZnQrZStcInB4XCI7YnJlYWs7Y2FzZVwibmVcIjppLnJvb3RIdG1sLnN0eWxlLndpZHRoPWkucm9vdEh0bWwub2Zmc2V0V2lkdGgrZStcInB4XCIsaS5yb290SHRtbC5zdHlsZS5oZWlnaHQ9aS5yb290SHRtbC5vZmZzZXRIZWlnaHQtdCtcInB4XCIsaS5yb290SHRtbC5zdHlsZS50b3A9aS5yb290SHRtbC5vZmZzZXRUb3ArdCtcInB4XCI7YnJlYWs7Y2FzZVwibndcIjppLnJvb3RIdG1sLnN0eWxlLmhlaWdodD1pLnJvb3RIdG1sLm9mZnNldEhlaWdodC10K1wicHhcIixpLnJvb3RIdG1sLnN0eWxlLnRvcD1pLnJvb3RIdG1sLm9mZnNldFRvcCt0K1wicHhcIixpLnJvb3RIdG1sLnN0eWxlLndpZHRoPWkucm9vdEh0bWwub2Zmc2V0V2lkdGgtZStcInB4XCIsaS5yb290SHRtbC5zdHlsZS5sZWZ0PWkucm9vdEh0bWwub2Zmc2V0TGVmdCtlK1wicHhcIjticmVhaztjYXNlXCJzZVwiOmkucm9vdEh0bWwuc3R5bGUud2lkdGg9aS5yb290SHRtbC5vZmZzZXRXaWR0aCtlK1wicHhcIixpLnJvb3RIdG1sLnN0eWxlLmhlaWdodD1pLnJvb3RIdG1sLm9mZnNldEhlaWdodCt0K1wicHhcIjticmVhaztjYXNlXCJzd1wiOmkucm9vdEh0bWwuc3R5bGUuaGVpZ2h0PWkucm9vdEh0bWwub2Zmc2V0SGVpZ2h0K3QrXCJweFwiLGkucm9vdEh0bWwuc3R5bGUud2lkdGg9aS5yb290SHRtbC5vZmZzZXRXaWR0aC1lK1wicHhcIixpLnJvb3RIdG1sLnN0eWxlLmxlZnQ9aS5yb290SHRtbC5vZmZzZXRMZWZ0K2UrXCJweFwifX12YXIgbD0wLGE9MDtlLnBhZ2VYP2w9ZS5wYWdlWDplLmNsaWVudFgmJihsPWUuY2xpZW50WCksZS5wYWdlWT9hPWUucGFnZVk6ZS5jbGllbnRZJiYoYT1lLmNsaWVudFkpLHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5yZW1vdmVBbGxSYW5nZXMoKSxkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIixuKSxkb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsbyl9c1tcImRlZmF1bHRcIl0uYXBwbHkodGhpcyk7dmFyIGk9dGhpcztlfHwoZT17fSk7dmFyIGw9IWUuYWN0aXZlO2kubWFya3VwPSdcXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1mbHlpbmctcGFuZWxcIlxcbiAgICAgICAgICAgIHN0eWxlPVwiXFxuICAgICAgICAgICAgICAgIHdpZHRoOiAnKyhlLnNpemU/ZS5zaXplLndpZHRoOlwiXCIpK1wiO1xcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IFwiKyhlLnNpemU/ZS5zaXplLmhlaWdodDpcIlwiKStcIjtcXG4gICAgICAgICAgICAgICAgbGVmdDogXCIrKGUucG9zaXRpb24/ZS5wb3NpdGlvbi54OlwiXCIpK1wiO1xcbiAgICAgICAgICAgICAgICB0b3A6IFwiKyhlLnBvc2l0aW9uP2UucG9zaXRpb24ueTpcIlwiKSsnO1xcbiAgICAgICAgICAgIFwiXFxuICAgICAgICA+XFxuICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRxLXVpLWZseWluZy1wYW5lbF9oZWFkZXJcIj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRxLXVpLWZseWluZy1wYW5lbF9oZWFkZXJfX2hlYWRlclwiPlxcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidHEtdWktd2luZG93LWhlYWRlci1sYWJlbFwiPicrKGUuaGVhZGVyP2UuaGVhZGVyOlwiXCIpKyc8L2xhYmVsPlxcbiAgICAgICAgICAgICAgICAgICAgPGltZyBjbGFzcz1cInRxLXVpLXdpbmRvd3MtY29sbGFwc2UtYnV0dG9uXCIvPlxcbiAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktYm9keVwiPlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktYm9keV9jb250YWluZXIgJysoZS5yZW1vdmVCYWNrZ3JvdW5kP1widHEtdWktYm9keV9lbXB0eS1jb250YWluZXJcIjpcInRxLXVpLWJvZHlfZGVmYXVsdC1jb250YWluZXJcIikrJ1wiPlxcbiAgICAgICAgICAgICAgICAgICAgJysoZS5ib2R5JiZcInN0cmluZ1wiPT10eXBlb2YgZS5ib2R5P2UuYm9keTpcIlwiKStcIlxcbiAgICAgICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICA8L2Rpdj5cXG4gICAgICAgICAgICBcIisoZS5yZXNpemFibGU/J1xcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIgdHEtdWktdG9wLWJvcmRlclwiPjwvZGl2PlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIgdHEtdWktcmlnaHQtYm9yZGVyXCI+PC9kaXY+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlciB0cS11aS1ib3R0b20tYm9yZGVyXCI+PC9kaXY+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlciB0cS11aS1sZWZ0LWJvcmRlclwiPjwvZGl2PlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktZmx5aW5nLXBhbmVsX19ib3JkZXIgdHEtdWktdG9wLWxlZnQtYm9yZGVyXCI+PC9kaXY+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlciB0cS11aS10b3AtcmlnaHQtYm9yZGVyXCI+PC9kaXY+XFxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1mbHlpbmctcGFuZWxfX2JvcmRlciB0cS11aS1ib3R0b20tbGVmdC1ib3JkZXJcIj48L2Rpdj5cXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRxLXVpLWZseWluZy1wYW5lbF9fYm9yZGVyIHRxLXVpLWJvdHRvbS1yaWdodC1ib3JkZXJcIj48L2Rpdj5cXG4gICAgICAgICAgICAnOlwiXCIpK1wiXFxuICAgICAgICA8L2Rpdj5cIjt2YXIgYT1yKGUuYmFzZUVsZW1lbnQpO2EuaW5uZXJIVE1MPWkubWFya3VwLGkucm9vdEh0bWw9YS5xdWVyeVNlbGVjdG9yKFwiLnRxLXVpLWZseWluZy1wYW5lbFwiKSxpLmlkPWUuaWR8fFwiZmx5aW5nUGFuZWwtXCIrdSsrLGkucm9vdEh0bWwuaWQ9aS5pZCxpLnNob3c9ZnVuY3Rpb24oZSl7ZSYmZS5zdG9wUHJvcGFnYXRpb24oKSxsJiYobD0hMSxuKCkpfSxpLmhpZGU9ZnVuY3Rpb24oZSl7ZSYmZS5zdG9wUHJvcGFnYXRpb24oKSxsfHwobD0hMCxuKCkpfSx0KCl9ZnVuY3Rpb24gcihlKXt2YXIgdD12b2lkIDA7cmV0dXJuXCJzdHJpbmdcIj09dHlwZW9mIGU/dD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZChlKTpcIm9iamVjdFwiPT09KFwidW5kZWZpbmVkXCI9PXR5cGVvZiBlP1widW5kZWZpbmVkXCI6bChlKSkmJih0PWUpLHR9T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIGw9XCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLml0ZXJhdG9yP2Z1bmN0aW9uKGUpe3JldHVybiB0eXBlb2YgZX06ZnVuY3Rpb24oZSl7cmV0dXJuIGUmJlwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmZS5jb25zdHJ1Y3Rvcj09PVN5bWJvbCYmZSE9PVN5bWJvbC5wcm90b3R5cGU/XCJzeW1ib2xcIjp0eXBlb2YgZX07bi5GbHlpbmdQYW5lbD1pO3ZhciBhPWUoXCIuL3N1YnNjcmlwdGlvbkFQSS9zdWJzY3JpYmVhYmxlXCIpLHM9byhhKSx1PTA7bltcImRlZmF1bHRcIl09aX0se1wiLi9zdWJzY3JpcHRpb25BUEkvc3Vic2NyaWJlYWJsZVwiOjh9XSwzOltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e1wiZGVmYXVsdFwiOmV9fWZ1bmN0aW9uIGkoZSl7ZnVuY3Rpb24gdChlKXtmdW5jdGlvbiB0KGUpe3ZhciB0PWUubGFiZWwsbj1lLmxhYmVsK1wiIChcIitlLmlkK1wiKVwiLG89ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIkxJXCIpO3JldHVybiBvLmNsYXNzTmFtZT1cInRxLXVpLXByb3BlcnR5LWJ1dHRvblwiLG8udGl0bGU9bixvLmlubmVyVGV4dD10LG8ub25jbGljaz1mdW5jdGlvbigpe2kudHJpZ2dlcihcInNlbGVjdGVkLWVsZW1lbnQtY2hhbmdlZFwiLGUuaWQpfSxvfXZhciBuPWkucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIiNyZWxhdGVkRWxlbWVudHNcIik7bi5pbm5lckhUTUw9XCJcIjt2YXIgbz1lLmluY29taW5nc3x8W107aWYoby5sZW5ndGgpe3ZhciByPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJMQUJFTFwiKTtyLmNsYXNzTmFtZT1cInRxLWxhYmVsXCIsci5pbm5lclRleHQ9XCJJbmNvbWluZyBub2RlczpcIixuLmFwcGVuZENoaWxkKHIpO3ZhciBsPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJVTFwiKTtsLmNsYXNzTmFtZT1cInRxLXVpLWluZm8tcGFuZWxfcmVsYXRlZC1lbGVtZW50c19saXN0XCIsbi5hcHBlbmRDaGlsZChsKSxvLmZvckVhY2goZnVuY3Rpb24oZSl7bC5hcHBlbmRDaGlsZCh0KGUpKX0pfXZhciBhPWUub3V0Z29pbmdzfHxbXTtpZihhLmxlbmd0aCl7dmFyIHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIkxBQkVMXCIpO3MuY2xhc3NOYW1lPVwidHEtbGFiZWxcIixzLmlubmVyVGV4dD1cIk91dGdvaW5nIG5vZGVzOlwiLG4uYXBwZW5kQ2hpbGQocyk7dmFyIHU9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIlVMXCIpO3UuY2xhc3NOYW1lPVwidHEtdWktaW5mby1wYW5lbF9yZWxhdGVkLWVsZW1lbnRzX2xpc3RcIixuLmFwcGVuZENoaWxkKHUpLGEuZm9yRWFjaChmdW5jdGlvbihlKXt1LmFwcGVuZENoaWxkKHQoZSkpfSl9fWZ1bmN0aW9uIG4oZSl7dmFyIHQ9XCJcIjtyZXR1cm4gT2JqZWN0LmtleXMoZSkuZm9yRWFjaChmdW5jdGlvbihuKXt0Kz0nPGxhYmVsIGZvcj1cIicrbisnXCIgY2xhc3M9XCJ0cS1sYWJlbFwiPicrbisnPC9sYWJlbD5cXG4gICAgICAgICAgICAgICAgICAgICAgICA8aW5wdXQgaWQ9XCInK24rJ1wiIHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ0cS11aS1wcm9wZXJ0eVwiIHZhbHVlPVwiJytlW25dKydcIiBkaXNhYmxlZD48L2lucHV0Pid9KSx0fWZ1bmN0aW9uIG8oKXt2YXIgZT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiRElWXCIpO3JldHVybiBlLmNsYXNzTmFtZT1cInRxLXVpLWluZm8tcGFuZWxcIixlLmlubmVySFRNTD1pLm1hcmt1cCxlfWxbXCJkZWZhdWx0XCJdLmFwcGx5KHRoaXMpLGV8fChlPXt9KTt2YXIgaT10aGlzLHI9ZS5wbGFjZWhvbGRlcnx8XCJTZWxlY3QgYSBkaWFncmFtIGVsZW1lbnRcIixzPSc8ZGl2IGNsYXNzPVwidHEtdWktaW5mby1wYW5lbF9lbXB0eS1zdHVmZlwiPicrcitcIjwvZGl2PlwiO2kucm9vdEh0bWw9bygpLGkucm9vdEh0bWwuaW5uZXJIVE1MPXMsaS5pZD1lLmlkfHxcImluZm9QYW5lbC1cIithKyssaS5yb290SHRtbC5pZD1pLmlkLGkuc2V0U2VsZWN0ZWRFbGVtZW50PWZ1bmN0aW9uKG8pe2lmKG8pe2lmKGkucm9vdEh0bWwuaW5uZXJIVE1MPVwiXCIrKGUubGF1bmNoRXh0ZXJuYWwmJlwibm9kZVwiPT09by5kaWFncmFtVHlwZT8nPGRpdiBjbGFzcz1cInRxLXVpLWdyb3VwXCI+XFxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJ0cUxhdW5jaEV4dGVybmFsQnRuXCIgY2xhc3M9XCJ0cS1idXR0b25cIiB0aXRsZT1cIlZpZXcgbW9yZSBpbiBuZXcgdGFiLlwiPlxcbiAgICAgICAgICAgICAgICAgICAgICAgIE1vcmUgJm5ic3A7XFxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZ2x5cGhpY29uIGdseXBoaWNvbi1uZXctd2luZG93XCI+PC9zcGFuPjwvYnV0dG9uPlxcbiAgICAgICAgICAgICAgICAgICAgIDwvZGl2Pic6XCJcIikrKG8uaWQ/J1xcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidHEtbGFiZWxcIj5JRDwvbGFiZWw+XFxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdmFsdWU9XCInK28uaWQrJ1wiIHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ0cS11aS1wcm9wZXJ0eVwiIGRpc2FibGVkPjwvaW5wdXQ+XFxuICAgICAgICAgICAgICAgICc6XCJcIikrKG8ubGFiZWw/J1xcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidHEtbGFiZWxcIj5MYWJlbDwvbGFiZWw+XFxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdmFsdWU9XCInK28ubGFiZWwrJ1wiIHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ0cS11aS1wcm9wZXJ0eVwiIGRpc2FibGVkPjwvaW5wdXQ+XFxuICAgICAgICAgICAgICAgICc6XCJcIikrKG8udHlwZXM/J1xcbiAgICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzPVwidHEtbGFiZWxcIj5UeXBlczwvbGFiZWw+XFxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdmFsdWU9XCInK28udHlwZXMrJ1wiIHR5cGU9XCJ0ZXh0XCIgY2xhc3M9XCJ0cS11aS1wcm9wZXJ0eVwiIGRpc2FibGVkPjwvaW5wdXQ+XFxuICAgICAgICAgICAgICAgICc6XCJcIikrKG8uc291cmNlPydcXG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBmb3I9XCJsaW5rRnJvbVwiIGNsYXNzPVwidHEtbGFiZWxcIj5Tb3VyY2U8L2xhYmVsPlxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cImxpbmtGcm9tXCIgdHlwZT1cInRleHRcIiBjbGFzcz1cInRxLXVpLXByb3BlcnR5LWJ1dHRvblwiPjwvZGl2PlxcbiAgICAgICAgICAgICAgICAnOlwiXCIpKyhvLnRhcmdldD8nXFxuICAgICAgICAgICAgICAgICAgICA8bGFiZWwgZm9yPVwibGlua1RvXCIgY2xhc3M9XCJ0cS1sYWJlbFwiPlRhcmdldDwvbGFiZWw+XFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGlkPVwibGlua1RvXCIgdHlwZT1cInRleHRcIiBjbGFzcz1cInRxLXVpLXByb3BlcnR5LWJ1dHRvblwiPjwvZGl2PlxcbiAgICAgICAgICAgICAgICAnOlwiXCIpKyhvLnRoaWNrbmVzcz8nXFxuICAgICAgICAgICAgICAgICAgICA8bGFiZWwgZm9yPVwidGhpY2tuZXNzXCIgY2xhc3M9XCJ0cS1sYWJlbFwiPlRoaWNrbmVzczwvbGFiZWw+XFxuICAgICAgICAgICAgICAgICAgICA8aW5wdXQgdmFsdWU9XCInK28udGhpY2tuZXNzKydcIiB0eXBlPVwidGV4dFwiIGNsYXNzPVwidHEtdWktcHJvcGVydHlcIiBkaXNhYmxlZD48L2lucHV0PlxcbiAgICAgICAgICAgICAgICAnOlwiXCIpKyhvLmRhdGE/bihvLmRhdGEpOlwiXCIpKyhvLnJlbGF0aW9ucz8nXFxuICAgICAgICAgICAgICAgICAgICA8bGFiZWwgZm9yPVwicmVsYXRlZEVsZW1lbnRzXCIgY2xhc3M9XCJ0cS1sYWJlbFwiPlJlbGF0ZWQgZWxlbWVudHM8L2xhYmVsPlxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiAgIGlkPVwicmVsYXRlZEVsZW1lbnRzXCIgY2xhc3M9XCJ0cS11aS1pbmZvLXBhbmVsX3JlbGF0ZWQtZWxlbWVudHNcIj48L2Rpdj5cXG4gICAgICAgICAgICAgICAgJzpcIlwiKSxlLmxhdW5jaEV4dGVybmFsJiZcIm5vZGVcIj09PW8uZGlhZ3JhbVR5cGUpe3ZhciByPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwidHFMYXVuY2hFeHRlcm5hbEJ0blwiKTtyLm9uY2xpY2s9ZnVuY3Rpb24oKXtlLmxhdW5jaEV4dGVybmFsKG8pfX1pZihvLnJlbGF0aW9ucyYmdChvLnJlbGF0aW9ucyksby5zb3VyY2Upe3ZhciBsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibGlua0Zyb21cIik7bC5pbm5lclRleHQ9by5zb3VyY2UubGFiZWwsbC50aXRsZT1vLnNvdXJjZS5sYWJlbCtcIihJRDogXCIrby5zb3VyY2UuaWQrXCIpXCIsbC5vbmNsaWNrPWZ1bmN0aW9uKCl7aS50cmlnZ2VyKFwic2VsZWN0ZWQtZWxlbWVudC1jaGFuZ2VkXCIsby5zb3VyY2UuaWQpfX1pZihvLnRhcmdldCl7dmFyIGE9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJsaW5rVG9cIik7YS5pbm5lclRleHQ9by50YXJnZXQubGFiZWwsYS50aXRsZT1vLnRhcmdldC5sYWJlbCtcIihJRDogXCIrby50YXJnZXQuaWQrXCIpXCIsYS5vbmNsaWNrPWZ1bmN0aW9uKCl7aS50cmlnZ2VyKFwic2VsZWN0ZWQtZWxlbWVudC1jaGFuZ2VkXCIsby50YXJnZXQuaWQpfX19ZWxzZSBpLnJvb3RIdG1sLmlubmVySFRNTD1zfSxlLnNlbGVjdGVkRWxlbWVudCYmaS5zZXRTZWxlY3RlZEVsZW1lbnQoZS5zZWxlY3RlZEVsZW1lbnQpfU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pLG4uSW5mb1BhbmVsPWk7dmFyIHI9ZShcIi4vc3Vic2NyaXB0aW9uQVBJL3N1YnNjcmliZWFibGVcIiksbD1vKHIpLGE9MDtuW1wiZGVmYXVsdFwiXT1pfSx7XCIuL3N1YnNjcmlwdGlvbkFQSS9zdWJzY3JpYmVhYmxlXCI6OH1dLDQ6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe2Z1bmN0aW9uIHQoKXt2YXIgZT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiRElWXCIpO3JldHVybiBlLmlubmVySFRNTD1uLm1hcmt1cCxlLnF1ZXJ5U2VsZWN0b3IoXCIudHEtdWktbGVnZW5kLXBhbmVsX2JvZHlfbGVnZW5kc1wiKX12YXIgbj10aGlzO2V8fChlPXt9KTt2YXIgbz1lLmxlZ2VuZHN8fFtdO24ubWFya3VwPSdcXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS1sZWdlbmQtcGFuZWxfYm9keV9sZWdlbmRzXCI+XFxuICAgICAgICAnK28ubWFwKGZ1bmN0aW9uKGUpe3JldHVybidcXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRxLXVpLWxlZ2VuZC1wYW5lbF9ib2R5X2xlZ2VuZHNfbGVnZW5kXCIgdGl0bGU9XCInK2UuZGVzY3JpcHRpb24rJ1wiPlxcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRxLXVpLWxlZ2VuZC1wYW5lbF9ib2R5X2xlZ2VuZHNfbGVnZW5kX2ltZ1wiPjxpbWcgc3JjPVwiJytlLmltYWdlKydcIj48L2Rpdj5cXG4gICAgICAgICAgICAgICAgICAgIDxsYWJlbCBjbGFzcz1cInRxLWxhYmVsXCI+JytlLmxhYmVsK1wiPC9sYWJlbD5cXG4gICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgXCJ9KS5qb2luKFwiXCIpK1wiXFxuICAgICAgICA8L2Rpdj5cXG4gICAgXCIsbi5yb290SHRtbD10KCksbi5pZD1lLmlkfHxcImxlZ2VuZHMtXCIraSsrLG4ucm9vdEh0bWwuaWQ9bi5pZH1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KSxuLkxlZ2VuZHM9bzt2YXIgaT0wO25bXCJkZWZhdWx0XCJdPW99LHt9XSw1OltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e1wiZGVmYXVsdFwiOmV9fXZhciBpPWUoXCIuL2NvbG9yZWRCdXR0b25zTGlzdFwiKSxyPW8oaSksbD1lKFwiLi9mbHlpbmdQYW5lbFwiKSxhPW8obCkscz1lKFwiLi9pbmZvUGFuZWxcIiksdT1vKHMpLGQ9ZShcIi4vbGVnZW5kc1wiKSxjPW8oZCksZj1lKFwiLi9wcm9ncmVzc1NjcmVlblwiKSxwPW8oZiksYj1lKFwiLi9zZWFyY2hQYW5lbFwiKSxtPW8oYikseT1lKFwiLi9zd2l0Y2hlclwiKSx2PW8oeSksZz1lKFwiLi90YWJQYW5lbFwiKSxoPW8oZyksSD1lKFwiLi90b29sYmFyXCIpLHE9byhIKTt0LmV4cG9ydHM9e0NvbG9yZWRCdXR0b25zTGlzdDpyW1wiZGVmYXVsdFwiXSxGbHlpbmdQYW5lbDphW1wiZGVmYXVsdFwiXSxJbmZvUGFuZWw6dVtcImRlZmF1bHRcIl0sTGVnZW5kczpjW1wiZGVmYXVsdFwiXSxQcm9ncmVzc1NjcmVlbjpwW1wiZGVmYXVsdFwiXSxTZWFyY2hQYW5lbDptW1wiZGVmYXVsdFwiXSxTd2l0Y2hlcjp2W1wiZGVmYXVsdFwiXSxUYWJQYW5lbDpoW1wiZGVmYXVsdFwiXSxUb29sYmFyOnFbXCJkZWZhdWx0XCJdfX0se1wiLi9jb2xvcmVkQnV0dG9uc0xpc3RcIjoxLFwiLi9mbHlpbmdQYW5lbFwiOjIsXCIuL2luZm9QYW5lbFwiOjMsXCIuL2xlZ2VuZHNcIjo0LFwiLi9wcm9ncmVzc1NjcmVlblwiOjYsXCIuL3NlYXJjaFBhbmVsXCI6NyxcIi4vc3dpdGNoZXJcIjo5LFwiLi90YWJQYW5lbFwiOjEwLFwiLi90b29sYmFyXCI6MTF9XSw2OltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e1wiZGVmYXVsdFwiOmV9fWZ1bmN0aW9uIGkoZSl7ZnVuY3Rpb24gdCgpe3ZhciBlPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJESVZcIik7cmV0dXJuIGUuY2xhc3NOYW1lPVwidHEtdWktcHJvZ3Jlc3Mtc2NyZWVuXCIsZS5pbm5lckhUTUw9by5tYXJrdXAsZX1mdW5jdGlvbiBuKGUpe3ZhciB0PXZvaWQgMDtyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgZT90PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGUpOlwib2JqZWN0XCI9PT0oXCJ1bmRlZmluZWRcIj09dHlwZW9mIGU/XCJ1bmRlZmluZWRcIjpyKGUpKSYmKHQ9ZSksdH1hW1wiZGVmYXVsdFwiXS5hcHBseSh0aGlzKTt2YXIgbz10aGlzO2V8fChlPXt9KSxvLm1hcmt1cD1cIlwiLG8uc3RhdGU9XCJjb21wbGV0ZWRcIixvLnJvb3RIdG1sPXQoKSxvLmlkPWUuaWR8fFwidGFiUGFuZWwtXCIrcysrLG8ucm9vdEh0bWwuaWQ9by5pZDt2YXIgaT1uKGUuYmFzZUVsZW1lbnQpO2kuYXBwZW5kQ2hpbGQoby5yb290SHRtbCksby5zZXRTdGF0ZT1mdW5jdGlvbihlLHQpe2UmJihvLnN0YXRlPWUsXCJhY3RpdmVcIj09PWU/KG8ucm9vdEh0bWwuaW5uZXJIVE1MPVwiPGgxPlwiKyh0fHx1KSsnPC9oMT48ZGl2IGNsYXNzPVwidHEtdWktcHJvZ3Jlc3Mtc2NyZWVuX19wcm9ncmVzc1wiPjwvZGl2Picsby5yb290SHRtbC5zdHlsZS5kaXNwbGF5PW51bGwpOlwiY29tcGxldGVkXCI9PT1lPyhvLnJvb3RIdG1sLmlubmVySFRNTD1cIlwiLG8ucm9vdEh0bWwuc3R5bGUuZGlzcGxheT1cIm5vbmVcIik6XCJlcnJvclwiPT09ZSYmKG8ucm9vdEh0bWwuaW5uZXJIVE1MPVwiPGgxPlwiKyh0fHxkKStcIjwvaDE+XCIsby5yb290SHRtbC5zdHlsZS5kaXNwbGF5PW51bGwpLG8udHJpZ2dlcihcImRpYWdyYW0tc3RhdGUtY2hhbmdlZFwiLGUpKX0sby5zZXRTdGF0ZShlLnN0YXRlLGUudGV4dCl9T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSk7dmFyIHI9XCJmdW5jdGlvblwiPT10eXBlb2YgU3ltYm9sJiZcInN5bWJvbFwiPT10eXBlb2YgU3ltYm9sLml0ZXJhdG9yP2Z1bmN0aW9uKGUpe3JldHVybiB0eXBlb2YgZX06ZnVuY3Rpb24oZSl7cmV0dXJuIGUmJlwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmZS5jb25zdHJ1Y3Rvcj09PVN5bWJvbCYmZSE9PVN5bWJvbC5wcm90b3R5cGU/XCJzeW1ib2xcIjp0eXBlb2YgZX07bi5Qcm9ncmVzc1NjcmVlbj1pO3ZhciBsPWUoXCIuL3N1YnNjcmlwdGlvbkFQSS9zdWJzY3JpYmVhYmxlXCIpLGE9byhsKSxzPTAsdT1cIkxvYWRpbmdcIixkPVwiRXJyb3IgaGFzIG9jY3VycmVkIVwiO25bXCJkZWZhdWx0XCJdPWl9LHtcIi4vc3Vic2NyaXB0aW9uQVBJL3N1YnNjcmliZWFibGVcIjo4fV0sNzpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7cmV0dXJuIGUmJmUuX19lc01vZHVsZT9lOntcImRlZmF1bHRcIjplfX1mdW5jdGlvbiBpKGUpe2xbXCJkZWZhdWx0XCJdLmFwcGx5KHRoaXMpLGV8fChlPXt9KTt2YXIgdD1lLnNlYXJjaEJ1dHRvbklkfHxcInRxTGdTZWFyY2hCdXR0b25cIixuPWUuc2VhcmNoSWR8fFwic2VhcmNoXCI7c1tcImRlZmF1bHRcIl0uYXBwbHkodGhpcyxbe2lkOmUuaWQsYmFzZUVsZW1lbnQ6ZS5iYXNlRWxlbWVudCxhY3RpdmU6ZS5hY3RpdmUsaGVhZGVyOmUuaGVhZGVyfHxcIlNlYXJjaCBwYW5lbFwiLHRyaWdnZXJCdXR0b246ZS50cmlnZ2VyQnV0dG9uLGJvZHk6XCJcXG4gICAgICAgICAgICA8c3BhbiBpZD0gXCIrdCsnIGNsYXNzPVwidHEtdWktc2VhcmNoLWljb24gZ2x5cGhpY29uIGdseXBoaWNvbi1zZWFyY2hcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+XFxuICAgICAgICAgICAgPGlucHV0IGlkPVwiJytuKydcIiBwbGFjZUhvbGRlcj1cIlNlYXJjaC4uLlwiIGNsYXNzPVwidHEtdWktc2VhcmNoLWlucHV0XCI+PC9pbnB1dD5cXG4gICAgICAgICcscmVtb3ZlQmFja2dyb3VuZDohMCxzaXplOnt3aWR0aDpcIjI2MHB4XCIsaGVpZ2h0OlwiNzBweFwifX1dKX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KSxuLlNlYXJjaFBhbmVsPWk7dmFyIHI9ZShcIi4vc3Vic2NyaXB0aW9uQVBJL3N1YnNjcmliZWFibGVcIiksbD1vKHIpLGE9ZShcIi4vZmx5aW5nUGFuZWxcIikscz1vKGEpO25bXCJkZWZhdWx0XCJdPWl9LHtcIi4vZmx5aW5nUGFuZWxcIjoyLFwiLi9zdWJzY3JpcHRpb25BUEkvc3Vic2NyaWJlYWJsZVwiOjh9XSw4OltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbygpe3ZhciBlPXRoaXM7ZS5fc3Vic2NyaWJ0aW9ucz17fSxlLm9uPWZ1bmN0aW9uKHQsbil7ZS5fc3Vic2NyaWJ0aW9uc1t0XXx8KGUuX3N1YnNjcmlidGlvbnNbdF09W10pLGUuX3N1YnNjcmlidGlvbnNbdF0ucHVzaChuKX0sZS51bnN1YnNjcmliZT1mdW5jdGlvbih0KXtPYmplY3Qua2V5cyhlLl9zdWJzY3JpYnRpb25zKS5tYXAoZnVuY3Rpb24odCl7cmV0dXJuIGUuX3N1YnNjcmlidGlvbnNbdF19KS5mb3JFYWNoKGZ1bmN0aW9uKGUpe3ZhciBuPWUuaW5kZXhPZih0KTtuIT09LTEmJmUuc3BsaWNlKG4sMSl9KX0sZS50cmlnZ2VyPWZ1bmN0aW9uKHQsbil7dmFyIG89dGhpcztuIGluc3RhbmNlb2YgQXJyYXl8fChuPVtuXSksZS5fc3Vic2NyaWJ0aW9ucyYmZS5fc3Vic2NyaWJ0aW9uc1t0XSYmZS5fc3Vic2NyaWJ0aW9uc1t0XS5mb3JFYWNoKGZ1bmN0aW9uKGUpe2UuYXBwbHkobyxuKX0pfX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KSxuLlN1YnNjcmliYWJsZT1vLG5bXCJkZWZhdWx0XCJdPW99LHt9XSw5OltmdW5jdGlvbihlLHQsbil7XCJ1c2Ugc3RyaWN0XCI7ZnVuY3Rpb24gbyhlKXtyZXR1cm4gZSYmZS5fX2VzTW9kdWxlP2U6e1wiZGVmYXVsdFwiOmV9fWZ1bmN0aW9uIGkoZSl7ZnVuY3Rpb24gdCgpe3ZhciB0PWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJESVZcIik7cmV0dXJuIHQuY2xhc3NOYW1lPVwidHEtdWktc3dpdGNoLWJ1dHRvbnNcIisoZS52ZXJ0aWNhbE9yaWVudGF0aW9uP1wiLXZlcnRpY2FsXCI6XCJcIiksdC5pbm5lckhUTUw9bi5tYXJrdXAsdH1sW1wiZGVmYXVsdFwiXS5hcHBseSh0aGlzKSxlfHwoZT17fSk7dmFyIG49dGhpcyxvPWUuc3RhdGVzfHxbXTtuLm1hcmt1cD1vLm1hcChmdW5jdGlvbih0LG4pe3JldHVybic8YnV0dG9uIGlkPVwiJyt0LmlkKydcIiAnKygwIT09bj9cIlwiOlwiZGlzYWJsZWRcIikrJyB0aXRsZT1cIicrKHQubGFiZWx8fHQuaWQpKydcIj5cXG4gICAgICAgICAgICAnKyhlLnZlcnRpY2FsT3JpZW50YXRpb24mJnQuaWNvbj8nPHNwYW4gY2xhc3M9XCInK3QuaWNvbisnXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9zcGFuPic6dC5sYWJlbHx8dC5pZCkrXCJcXG4gICAgICAgIDwvYnV0dG9uPlwifSkuam9pbihcIlwiKSxuLnJvb3RIdG1sPXQoKSxuLmlkPWUuaWR8fFwic3dpdGNoZXItXCIrYSsrLG4ucm9vdEh0bWwuaWQ9bi5pZDt2YXIgaT1udWxsO28uZm9yRWFjaChmdW5jdGlvbihlLHQpe3ZhciBvPW4ucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIiNcIitlLmlkKTswPT09dCYmKGk9byksby5vbmNsaWNrPWZ1bmN0aW9uKCl7by5kaXNhYmxlZD0hMCxpLmRpc2FibGVkPSExLGk9byxuLnRyaWdnZXIoXCJzdGF0ZS1jaGFuZ2VkXCIsZS5pZCl9fSksbi5zZXRTdGF0ZT1mdW5jdGlvbihlKXt2YXIgdD1uLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIjXCIrZSk7dCYmZSE9PWkuaWQmJih0LmRpc2FibGVkPSEwLGkuZGlzYWJsZWQ9ITEsaT10KX19T2JqZWN0LmRlZmluZVByb3BlcnR5KG4sXCJfX2VzTW9kdWxlXCIse3ZhbHVlOiEwfSksbi5Td2l0Y2hlcj1pO3ZhciByPWUoXCIuL3N1YnNjcmlwdGlvbkFQSS9zdWJzY3JpYmVhYmxlXCIpLGw9byhyKSxhPTA7bltcImRlZmF1bHRcIl09aX0se1wiLi9zdWJzY3JpcHRpb25BUEkvc3Vic2NyaWJlYWJsZVwiOjh9XSwxMDpbZnVuY3Rpb24oZSx0LG4pe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oZSl7ZnVuY3Rpb24gdCgpe3ZhciBlPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJESVZcIik7cmV0dXJuIGUuY2xhc3NOYW1lPVwidHEtdWktdGFiLXBhbmVsXCIsZS5pbm5lckhUTUw9bi5tYXJrdXAsZX12YXIgbj10aGlzO2V8fChlPXt9KTt2YXIgbz1lLnRhYnN8fFtdO24ubWFya3VwPSdcXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ0cS11aS10YWItc3dpdGNoZXIgdHEtdWktc3dpdGNoLWJ1dHRvbnNcIj4nK28ubWFwKGZ1bmN0aW9uKGUsdCl7cmV0dXJuJ1xcbiAgICAgICAgICAgIDxidXR0b24gaWQ9XCInK2UuaWQrJ1wiICcrKDAhPT10P1wiXCI6XCJkaXNhYmxlZFwiKStcIj5cXG4gICAgICAgICAgICAgICAgXCIrKGUubGFiZWx8fGUuaWQpK1wiXFxuICAgICAgICAgICAgPC9idXR0b24+ICBcXG4gICAgICAgIFwifSkuam9pbihcIlwiKStcIjwvZGl2PlwiK28ubWFwKGZ1bmN0aW9uKGUsdCl7cmV0dXJuJ1xcbiAgICAgICAgICAgIDxkaXYgaWQ9XCInK2UuaWQrJ1BhbmVsXCIgY2xhc3M9XCJ0cS11aS10YWItcGFuZWxfcGFnZVwiIHN0eWxlPVwiZGlzcGxheTogJysoMD09PXQ/XCJcIjpcIm5vbmVcIikrJ1wiPlxcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidHEtdWktdGFiLXBhbmVsX3BhZ2VfYm9keVwiPlxcbiAgICAgICAgICAgICAgICAgICAgJysoXCJzdHJpbmdcIj09dHlwZW9mIGUuYm9keT9lLmJvZHk6XCJcIikrXCJcXG4gICAgICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICAgICAgPC9kaXY+XFxuICAgICAgICBcIn0pLmpvaW4oXCJcIiksbi5yb290SHRtbD10KCksbi5pZD1lLmlkfHxcInRhYlBhbmVsLVwiK2krKyxuLnJvb3RIdG1sLmlkPW4uaWQsby5tYXAoZnVuY3Rpb24oZSl7aWYoZS5ib2R5IGluc3RhbmNlb2YgT2JqZWN0JiZlLmJvZHkucm9vdEh0bWwpe3ZhciB0PW4ucm9vdEh0bWwucXVlcnlTZWxlY3RvcihcIiNcIitlLmlkK1wiUGFuZWwgLnRxLXVpLXRhYi1wYW5lbF9wYWdlX2JvZHlcIik7dC5hcHBlbmRDaGlsZChlLmJvZHkucm9vdEh0bWwpfX0pO3ZhciByPW51bGw7by5mb3JFYWNoKGZ1bmN0aW9uKGUsdCl7dmFyIG89bi5yb290SHRtbC5xdWVyeVNlbGVjdG9yKFwiI1wiK2UuaWQpLGk9bi5yb290SHRtbC5xdWVyeVNlbGVjdG9yKFwiI1wiK2UuaWQrXCJQYW5lbFwiKTswPT09dCYmKHI9e3RhYkJ0bjpvLHRhYlBhbmVsOml9KSxvLm9uY2xpY2s9ZnVuY3Rpb24oKXtvLmRpc2FibGVkPSEwLGkuc3R5bGUuZGlzcGxheT1cIlwiLHIudGFiQnRuLmRpc2FibGVkPSExLHIudGFiUGFuZWwuc3R5bGUuZGlzcGxheT1cIm5vbmVcIixyPXt0YWJCdG46byx0YWJQYW5lbDppfX19KX1PYmplY3QuZGVmaW5lUHJvcGVydHkobixcIl9fZXNNb2R1bGVcIix7dmFsdWU6ITB9KSxuLlRhYlBhbmVsPW87dmFyIGk9MDtuW1wiZGVmYXVsdFwiXT1vfSx7fV0sMTE6W2Z1bmN0aW9uKGUsdCxuKXtcInVzZSBzdHJpY3RcIjtmdW5jdGlvbiBvKGUpe2Z1bmN0aW9uIHQoZSl7dmFyIHQ9dm9pZCAwO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlKXt2YXIgbj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiRElWXCIpO24uaW5uZXJIVE1MPWUsdD1uLmZpcnN0Q2hpbGR9ZWxzZSBpZihlLmlkJiZlLmljb24pe3ZhciBvPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJESVZcIik7aWYoby5pbm5lckhUTUw9JzxidXR0b24gaWQ9XCInK2UuaWQrJ1wiIHRpdGxlPVwiJysoZS5sYWJlbHx8ZS5pZCkrJ1wiIGNsYXNzPVwidHEtdWktdG9vbGJhcl9fYnV0dG9uXCI+XFxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiJytlLmljb24rJ1wiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvc3Bhbj5cXG4gICAgICAgICAgICA8L2J1dHRvbj4nLHQ9by5maXJzdENoaWxkLGUuaWNvbjIpe3ZhciBpPSEwO3Qub25jbGljaz1mdW5jdGlvbihuKXt0LmlubmVySFRNTD0nPHNwYW4gY2xhc3M9XCInKyhpP2UuaWNvbjI6ZS5pY29uKSsnXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9zcGFuPicsZS5jYWxsYmFjayhuKSxpPSFpfX1lbHNlIHQub25jbGljaz1lLmNhbGxiYWNrfWVsc2UgZS5yb290SHRtbCYmKHQ9ZS5yb290SHRtbCk7cmV0dXJuIHR9ZnVuY3Rpb24gbigpe3ZhciB0PXZvaWQgMDtyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgZS5iYXNlRWxlbWVudD90PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGUuYmFzZUVsZW1lbnQpOlwib2JqZWN0XCI9PT1pKGUuYmFzZUVsZW1lbnQpJiYodD1lLmJhc2VFbGVtZW50KSx0Pyh0LmlubmVySFRNTD1vLm1hcmt1cCx0KTpudWxsfXZhciBvPXRoaXM7aWYoZXx8KGU9e30pLG8ubWFya3VwPSdcXG4gICAgICAgIDxkaXYgaWQ9XCJ0b29sYmFyUm9vdEVsZW1lbnRcIiBjbGFzcz1cInRxLXVpLXRvb2xiYXJcIj5cXG4gICAgICAgIDwvZGl2PlxcbiAgICAnLG8ucm9vdEh0bWw9bigpLG8uaWQ9ZS5pZHx8XCJ0b29sYmFyLVwiK3IrKyxvLnJvb3RIdG1sLmlkPW8uaWQsIW8ucm9vdEh0bWwpdGhyb3cgbmV3IEVycm9yKFwiVGhlIHJvb3QgZWxlbWVudCBpcyBub3Qgc3BlY2lmaWVkIVwiKTtvLmNvbnRhaW5lcj1vLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoXCIjdG9vbGJhclJvb3RFbGVtZW50XCIpLG8ucHVzaFRvb2w9ZnVuY3Rpb24oZSl7dmFyIG49dChlKTtuJiYoXCJzdHJpbmdcIiE9dHlwZW9mIG4/bC5wdXNoKGUpOmwucHVzaCh7aWQ6XCJjdXN0b21odG1sXCIrcisrLG1hcmt1cDplLHJvb3RIdG1sOm59KSxvLmNvbnRhaW5lci5hcHBlbmRDaGlsZChuKSl9LG8uaW5zZXJ0VG9vbD1mdW5jdGlvbihlLG4pe3ZhciBpPU1hdGgubWluKE1hdGgubWF4KG4sMCksbC5sZW5ndGgtMSkscj1vLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKFwiI1wiK2xbaV0uaWQpO2lmKHIpe3ZhciBhPXQoZSk7YSYmKGwuc3BsaWNlKGksMCxlKSxvLmNvbnRhaW5lci5pbnNlcnRCZWZvcmUoYSxyKSl9ZWxzZSBvLnB1c2hUb29sKGUpfSxvLnJlbW92ZVRvb2w9ZnVuY3Rpb24oZSl7dmFyIHQ9XCJzdHJpbmdcIj09dHlwZW9mIGU/ZTplLmlkO2wuc3BsaWNlKGwuaW5kZXhPZihlKSwxKTt2YXIgbj1vLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKFwiI1wiK3QpO28uY29udGFpbmVyLnJlbW92ZUNoaWxkKG4pfTt2YXIgbD1bXTtlLnRvb2xzLmZvckVhY2goZnVuY3Rpb24oZSl7by5wdXNoVG9vbChlKX0pfU9iamVjdC5kZWZpbmVQcm9wZXJ0eShuLFwiX19lc01vZHVsZVwiLHt2YWx1ZTohMH0pO3ZhciBpPVwiZnVuY3Rpb25cIj09dHlwZW9mIFN5bWJvbCYmXCJzeW1ib2xcIj09dHlwZW9mIFN5bWJvbC5pdGVyYXRvcj9mdW5jdGlvbihlKXtyZXR1cm4gdHlwZW9mIGV9OmZ1bmN0aW9uKGUpe3JldHVybiBlJiZcImZ1bmN0aW9uXCI9PXR5cGVvZiBTeW1ib2wmJmUuY29uc3RydWN0b3I9PT1TeW1ib2wmJmUhPT1TeW1ib2wucHJvdG90eXBlP1wic3ltYm9sXCI6dHlwZW9mIGV9O24uVG9vbGJhcj1vO3ZhciByPTA7bltcImRlZmF1bHRcIl09b30se31dfSx7fSxbNV0pKDUpfSk7IiwiKGZ1bmN0aW9uKHNlbGYpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIGlmIChzZWxmLmZldGNoKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICB2YXIgc3VwcG9ydCA9IHtcbiAgICBzZWFyY2hQYXJhbXM6ICdVUkxTZWFyY2hQYXJhbXMnIGluIHNlbGYsXG4gICAgaXRlcmFibGU6ICdTeW1ib2wnIGluIHNlbGYgJiYgJ2l0ZXJhdG9yJyBpbiBTeW1ib2wsXG4gICAgYmxvYjogJ0ZpbGVSZWFkZXInIGluIHNlbGYgJiYgJ0Jsb2InIGluIHNlbGYgJiYgKGZ1bmN0aW9uKCkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgbmV3IEJsb2IoKVxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH0pKCksXG4gICAgZm9ybURhdGE6ICdGb3JtRGF0YScgaW4gc2VsZixcbiAgICBhcnJheUJ1ZmZlcjogJ0FycmF5QnVmZmVyJyBpbiBzZWxmXG4gIH1cblxuICBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlcikge1xuICAgIHZhciB2aWV3Q2xhc3NlcyA9IFtcbiAgICAgICdbb2JqZWN0IEludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgVWludDhDbGFtcGVkQXJyYXldJyxcbiAgICAgICdbb2JqZWN0IEludDE2QXJyYXldJyxcbiAgICAgICdbb2JqZWN0IFVpbnQxNkFycmF5XScsXG4gICAgICAnW29iamVjdCBJbnQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBVaW50MzJBcnJheV0nLFxuICAgICAgJ1tvYmplY3QgRmxvYXQzMkFycmF5XScsXG4gICAgICAnW29iamVjdCBGbG9hdDY0QXJyYXldJ1xuICAgIF1cblxuICAgIHZhciBpc0RhdGFWaWV3ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIERhdGFWaWV3LnByb3RvdHlwZS5pc1Byb3RvdHlwZU9mKG9iailcbiAgICB9XG5cbiAgICB2YXIgaXNBcnJheUJ1ZmZlclZpZXcgPSBBcnJheUJ1ZmZlci5pc1ZpZXcgfHwgZnVuY3Rpb24ob2JqKSB7XG4gICAgICByZXR1cm4gb2JqICYmIHZpZXdDbGFzc2VzLmluZGV4T2YoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikpID4gLTFcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVOYW1lKG5hbWUpIHtcbiAgICBpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICBuYW1lID0gU3RyaW5nKG5hbWUpXG4gICAgfVxuICAgIGlmICgvW15hLXowLTlcXC0jJCUmJyorLlxcXl9gfH5dL2kudGVzdChuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBjaGFyYWN0ZXIgaW4gaGVhZGVyIGZpZWxkIG5hbWUnKVxuICAgIH1cbiAgICByZXR1cm4gbmFtZS50b0xvd2VyQ2FzZSgpXG4gIH1cblxuICBmdW5jdGlvbiBub3JtYWxpemVWYWx1ZSh2YWx1ZSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG4gICAgICB2YWx1ZSA9IFN0cmluZyh2YWx1ZSlcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlXG4gIH1cblxuICAvLyBCdWlsZCBhIGRlc3RydWN0aXZlIGl0ZXJhdG9yIGZvciB0aGUgdmFsdWUgbGlzdFxuICBmdW5jdGlvbiBpdGVyYXRvckZvcihpdGVtcykge1xuICAgIHZhciBpdGVyYXRvciA9IHtcbiAgICAgIG5leHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdmFsdWUgPSBpdGVtcy5zaGlmdCgpXG4gICAgICAgIHJldHVybiB7ZG9uZTogdmFsdWUgPT09IHVuZGVmaW5lZCwgdmFsdWU6IHZhbHVlfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzdXBwb3J0Lml0ZXJhYmxlKSB7XG4gICAgICBpdGVyYXRvcltTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBpdGVyYXRvclxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBpdGVyYXRvclxuICB9XG5cbiAgZnVuY3Rpb24gSGVhZGVycyhoZWFkZXJzKSB7XG4gICAgdGhpcy5tYXAgPSB7fVxuXG4gICAgaWYgKGhlYWRlcnMgaW5zdGFuY2VvZiBIZWFkZXJzKSB7XG4gICAgICBoZWFkZXJzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgdmFsdWUpXG4gICAgICB9LCB0aGlzKVxuXG4gICAgfSBlbHNlIGlmIChoZWFkZXJzKSB7XG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQobmFtZSwgaGVhZGVyc1tuYW1lXSlcbiAgICAgIH0sIHRoaXMpXG4gICAgfVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICBuYW1lID0gbm9ybWFsaXplTmFtZShuYW1lKVxuICAgIHZhbHVlID0gbm9ybWFsaXplVmFsdWUodmFsdWUpXG4gICAgdmFyIGxpc3QgPSB0aGlzLm1hcFtuYW1lXVxuICAgIGlmICghbGlzdCkge1xuICAgICAgbGlzdCA9IFtdXG4gICAgICB0aGlzLm1hcFtuYW1lXSA9IGxpc3RcbiAgICB9XG4gICAgbGlzdC5wdXNoKHZhbHVlKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGVbJ2RlbGV0ZSddID0gZnVuY3Rpb24obmFtZSkge1xuICAgIGRlbGV0ZSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24obmFtZSkge1xuICAgIHZhciB2YWx1ZXMgPSB0aGlzLm1hcFtub3JtYWxpemVOYW1lKG5hbWUpXVxuICAgIHJldHVybiB2YWx1ZXMgPyB2YWx1ZXNbMF0gOiBudWxsXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldIHx8IFtdXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMubWFwLmhhc093blByb3BlcnR5KG5vcm1hbGl6ZU5hbWUobmFtZSkpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihuYW1lLCB2YWx1ZSkge1xuICAgIHRoaXMubWFwW25vcm1hbGl6ZU5hbWUobmFtZSldID0gW25vcm1hbGl6ZVZhbHVlKHZhbHVlKV1cbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKHRoaXMubWFwKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHRoaXMubWFwW25hbWVdLmZvckVhY2goZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2YWx1ZSwgbmFtZSwgdGhpcylcbiAgICAgIH0sIHRoaXMpXG4gICAgfSwgdGhpcylcbiAgfVxuXG4gIEhlYWRlcnMucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgaXRlbXMgPSBbXVxuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkgeyBpdGVtcy5wdXNoKG5hbWUpIH0pXG4gICAgcmV0dXJuIGl0ZXJhdG9yRm9yKGl0ZW1zKVxuICB9XG5cbiAgSGVhZGVycy5wcm90b3R5cGUudmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUpIHsgaXRlbXMucHVzaCh2YWx1ZSkgfSlcbiAgICByZXR1cm4gaXRlcmF0b3JGb3IoaXRlbXMpXG4gIH1cblxuICBIZWFkZXJzLnByb3RvdHlwZS5lbnRyaWVzID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGl0ZW1zID0gW11cbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24odmFsdWUsIG5hbWUpIHsgaXRlbXMucHVzaChbbmFtZSwgdmFsdWVdKSB9KVxuICAgIHJldHVybiBpdGVyYXRvckZvcihpdGVtcylcbiAgfVxuXG4gIGlmIChzdXBwb3J0Lml0ZXJhYmxlKSB7XG4gICAgSGVhZGVycy5wcm90b3R5cGVbU3ltYm9sLml0ZXJhdG9yXSA9IEhlYWRlcnMucHJvdG90eXBlLmVudHJpZXNcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvbnN1bWVkKGJvZHkpIHtcbiAgICBpZiAoYm9keS5ib2R5VXNlZCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBUeXBlRXJyb3IoJ0FscmVhZHkgcmVhZCcpKVxuICAgIH1cbiAgICBib2R5LmJvZHlVc2VkID0gdHJ1ZVxuICB9XG5cbiAgZnVuY3Rpb24gZmlsZVJlYWRlclJlYWR5KHJlYWRlcikge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZWFkZXIucmVzdWx0KVxuICAgICAgfVxuICAgICAgcmVhZGVyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlYWRlci5lcnJvcilcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEJsb2JBc0FycmF5QnVmZmVyKGJsb2IpIHtcbiAgICB2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKVxuICAgIHZhciBwcm9taXNlID0gZmlsZVJlYWRlclJlYWR5KHJlYWRlcilcbiAgICByZWFkZXIucmVhZEFzQXJyYXlCdWZmZXIoYmxvYilcbiAgICByZXR1cm4gcHJvbWlzZVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZEJsb2JBc1RleHQoYmxvYikge1xuICAgIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpXG4gICAgdmFyIHByb21pc2UgPSBmaWxlUmVhZGVyUmVhZHkocmVhZGVyKVxuICAgIHJlYWRlci5yZWFkQXNUZXh0KGJsb2IpXG4gICAgcmV0dXJuIHByb21pc2VcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRBcnJheUJ1ZmZlckFzVGV4dChidWYpIHtcbiAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGJ1ZilcbiAgICB2YXIgY2hhcnMgPSBuZXcgQXJyYXkodmlldy5sZW5ndGgpXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHZpZXcubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNoYXJzW2ldID0gU3RyaW5nLmZyb21DaGFyQ29kZSh2aWV3W2ldKVxuICAgIH1cbiAgICByZXR1cm4gY2hhcnMuam9pbignJylcbiAgfVxuXG4gIGZ1bmN0aW9uIGJ1ZmZlckNsb25lKGJ1Zikge1xuICAgIGlmIChidWYuc2xpY2UpIHtcbiAgICAgIHJldHVybiBidWYuc2xpY2UoMClcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShidWYuYnl0ZUxlbmd0aClcbiAgICAgIHZpZXcuc2V0KG5ldyBVaW50OEFycmF5KGJ1ZikpXG4gICAgICByZXR1cm4gdmlldy5idWZmZXJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBCb2R5KCkge1xuICAgIHRoaXMuYm9keVVzZWQgPSBmYWxzZVxuXG4gICAgdGhpcy5faW5pdEJvZHkgPSBmdW5jdGlvbihib2R5KSB7XG4gICAgICB0aGlzLl9ib2R5SW5pdCA9IGJvZHlcbiAgICAgIGlmICghYm9keSkge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9ICcnXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJykge1xuICAgICAgICB0aGlzLl9ib2R5VGV4dCA9IGJvZHlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5ibG9iICYmIEJsb2IucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUJsb2IgPSBib2R5XG4gICAgICB9IGVsc2UgaWYgKHN1cHBvcnQuZm9ybURhdGEgJiYgRm9ybURhdGEucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgdGhpcy5fYm9keUZvcm1EYXRhID0gYm9keVxuICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LnNlYXJjaFBhcmFtcyAmJiBVUkxTZWFyY2hQYXJhbXMucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgdGhpcy5fYm9keVRleHQgPSBib2R5LnRvU3RyaW5nKClcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlciAmJiBzdXBwb3J0LmJsb2IgJiYgaXNEYXRhVmlldyhib2R5KSkge1xuICAgICAgICB0aGlzLl9ib2R5QXJyYXlCdWZmZXIgPSBidWZmZXJDbG9uZShib2R5LmJ1ZmZlcilcbiAgICAgICAgLy8gSUUgMTAtMTEgY2FuJ3QgaGFuZGxlIGEgRGF0YVZpZXcgYm9keS5cbiAgICAgICAgdGhpcy5fYm9keUluaXQgPSBuZXcgQmxvYihbdGhpcy5fYm9keUFycmF5QnVmZmVyXSlcbiAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheUJ1ZmZlciAmJiAoQXJyYXlCdWZmZXIucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkgfHwgaXNBcnJheUJ1ZmZlclZpZXcoYm9keSkpKSB7XG4gICAgICAgIHRoaXMuX2JvZHlBcnJheUJ1ZmZlciA9IGJ1ZmZlckNsb25lKGJvZHkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIEJvZHlJbml0IHR5cGUnKVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuaGVhZGVycy5nZXQoJ2NvbnRlbnQtdHlwZScpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgYm9keSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCAndGV4dC9wbGFpbjtjaGFyc2V0PVVURi04JylcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QmxvYiAmJiB0aGlzLl9ib2R5QmxvYi50eXBlKSB7XG4gICAgICAgICAgdGhpcy5oZWFkZXJzLnNldCgnY29udGVudC10eXBlJywgdGhpcy5fYm9keUJsb2IudHlwZSlcbiAgICAgICAgfSBlbHNlIGlmIChzdXBwb3J0LnNlYXJjaFBhcmFtcyAmJiBVUkxTZWFyY2hQYXJhbXMucHJvdG90eXBlLmlzUHJvdG90eXBlT2YoYm9keSkpIHtcbiAgICAgICAgICB0aGlzLmhlYWRlcnMuc2V0KCdjb250ZW50LXR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9VVRGLTgnKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHN1cHBvcnQuYmxvYikge1xuICAgICAgdGhpcy5ibG9iID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICAgIGlmIChyZWplY3RlZCkge1xuICAgICAgICAgIHJldHVybiByZWplY3RlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JvZHlCbG9iKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5QmxvYilcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBCbG9iKFt0aGlzLl9ib2R5QXJyYXlCdWZmZXJdKSlcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5Rm9ybURhdGEpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvdWxkIG5vdCByZWFkIEZvcm1EYXRhIGJvZHkgYXMgYmxvYicpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShuZXcgQmxvYihbdGhpcy5fYm9keVRleHRdKSlcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLmFycmF5QnVmZmVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpIHtcbiAgICAgICAgICByZXR1cm4gY29uc3VtZWQodGhpcykgfHwgUHJvbWlzZS5yZXNvbHZlKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcilcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5ibG9iKCkudGhlbihyZWFkQmxvYkFzQXJyYXlCdWZmZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnRleHQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciByZWplY3RlZCA9IGNvbnN1bWVkKHRoaXMpXG4gICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdGVkXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9ib2R5QmxvYikge1xuICAgICAgICByZXR1cm4gcmVhZEJsb2JBc1RleHQodGhpcy5fYm9keUJsb2IpXG4gICAgICB9IGVsc2UgaWYgKHRoaXMuX2JvZHlBcnJheUJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlYWRBcnJheUJ1ZmZlckFzVGV4dCh0aGlzLl9ib2R5QXJyYXlCdWZmZXIpKVxuICAgICAgfSBlbHNlIGlmICh0aGlzLl9ib2R5Rm9ybURhdGEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZCBub3QgcmVhZCBGb3JtRGF0YSBib2R5IGFzIHRleHQnKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLl9ib2R5VGV4dClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoc3VwcG9ydC5mb3JtRGF0YSkge1xuICAgICAgdGhpcy5mb3JtRGF0YSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihkZWNvZGUpXG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5qc29uID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gdGhpcy50ZXh0KCkudGhlbihKU09OLnBhcnNlKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICAvLyBIVFRQIG1ldGhvZHMgd2hvc2UgY2FwaXRhbGl6YXRpb24gc2hvdWxkIGJlIG5vcm1hbGl6ZWRcbiAgdmFyIG1ldGhvZHMgPSBbJ0RFTEVURScsICdHRVQnLCAnSEVBRCcsICdPUFRJT05TJywgJ1BPU1QnLCAnUFVUJ11cblxuICBmdW5jdGlvbiBub3JtYWxpemVNZXRob2QobWV0aG9kKSB7XG4gICAgdmFyIHVwY2FzZWQgPSBtZXRob2QudG9VcHBlckNhc2UoKVxuICAgIHJldHVybiAobWV0aG9kcy5pbmRleE9mKHVwY2FzZWQpID4gLTEpID8gdXBjYXNlZCA6IG1ldGhvZFxuICB9XG5cbiAgZnVuY3Rpb24gUmVxdWVzdChpbnB1dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHlcblxuICAgIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLnVybCA9IGlucHV0XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpbnB1dC5ib2R5VXNlZCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBbHJlYWR5IHJlYWQnKVxuICAgICAgfVxuICAgICAgdGhpcy51cmwgPSBpbnB1dC51cmxcbiAgICAgIHRoaXMuY3JlZGVudGlhbHMgPSBpbnB1dC5jcmVkZW50aWFsc1xuICAgICAgaWYgKCFvcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMoaW5wdXQuaGVhZGVycylcbiAgICAgIH1cbiAgICAgIHRoaXMubWV0aG9kID0gaW5wdXQubWV0aG9kXG4gICAgICB0aGlzLm1vZGUgPSBpbnB1dC5tb2RlXG4gICAgICBpZiAoIWJvZHkgJiYgaW5wdXQuX2JvZHlJbml0ICE9IG51bGwpIHtcbiAgICAgICAgYm9keSA9IGlucHV0Ll9ib2R5SW5pdFxuICAgICAgICBpbnB1dC5ib2R5VXNlZCA9IHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNyZWRlbnRpYWxzID0gb3B0aW9ucy5jcmVkZW50aWFscyB8fCB0aGlzLmNyZWRlbnRpYWxzIHx8ICdvbWl0J1xuICAgIGlmIChvcHRpb25zLmhlYWRlcnMgfHwgIXRoaXMuaGVhZGVycykge1xuICAgICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIH1cbiAgICB0aGlzLm1ldGhvZCA9IG5vcm1hbGl6ZU1ldGhvZChvcHRpb25zLm1ldGhvZCB8fCB0aGlzLm1ldGhvZCB8fCAnR0VUJylcbiAgICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgfHwgdGhpcy5tb2RlIHx8IG51bGxcbiAgICB0aGlzLnJlZmVycmVyID0gbnVsbFxuXG4gICAgaWYgKCh0aGlzLm1ldGhvZCA9PT0gJ0dFVCcgfHwgdGhpcy5tZXRob2QgPT09ICdIRUFEJykgJiYgYm9keSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQm9keSBub3QgYWxsb3dlZCBmb3IgR0VUIG9yIEhFQUQgcmVxdWVzdHMnKVxuICAgIH1cbiAgICB0aGlzLl9pbml0Qm9keShib2R5KVxuICB9XG5cbiAgUmVxdWVzdC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFJlcXVlc3QodGhpcywgeyBib2R5OiB0aGlzLl9ib2R5SW5pdCB9KVxuICB9XG5cbiAgZnVuY3Rpb24gZGVjb2RlKGJvZHkpIHtcbiAgICB2YXIgZm9ybSA9IG5ldyBGb3JtRGF0YSgpXG4gICAgYm9keS50cmltKCkuc3BsaXQoJyYnKS5mb3JFYWNoKGZ1bmN0aW9uKGJ5dGVzKSB7XG4gICAgICBpZiAoYnl0ZXMpIHtcbiAgICAgICAgdmFyIHNwbGl0ID0gYnl0ZXMuc3BsaXQoJz0nKVxuICAgICAgICB2YXIgbmFtZSA9IHNwbGl0LnNoaWZ0KCkucmVwbGFjZSgvXFwrL2csICcgJylcbiAgICAgICAgdmFyIHZhbHVlID0gc3BsaXQuam9pbignPScpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gICAgICAgIGZvcm0uYXBwZW5kKGRlY29kZVVSSUNvbXBvbmVudChuYW1lKSwgZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSlcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiBmb3JtXG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZUhlYWRlcnMocmF3SGVhZGVycykge1xuICAgIHZhciBoZWFkZXJzID0gbmV3IEhlYWRlcnMoKVxuICAgIHJhd0hlYWRlcnMuc3BsaXQoJ1xcclxcbicpLmZvckVhY2goZnVuY3Rpb24obGluZSkge1xuICAgICAgdmFyIHBhcnRzID0gbGluZS5zcGxpdCgnOicpXG4gICAgICB2YXIga2V5ID0gcGFydHMuc2hpZnQoKS50cmltKClcbiAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcGFydHMuam9pbignOicpLnRyaW0oKVxuICAgICAgICBoZWFkZXJzLmFwcGVuZChrZXksIHZhbHVlKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIGhlYWRlcnNcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXF1ZXN0LnByb3RvdHlwZSlcblxuICBmdW5jdGlvbiBSZXNwb25zZShib2R5SW5pdCwgb3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gJ2RlZmF1bHQnXG4gICAgdGhpcy5zdGF0dXMgPSAnc3RhdHVzJyBpbiBvcHRpb25zID8gb3B0aW9ucy5zdGF0dXMgOiAyMDBcbiAgICB0aGlzLm9rID0gdGhpcy5zdGF0dXMgPj0gMjAwICYmIHRoaXMuc3RhdHVzIDwgMzAwXG4gICAgdGhpcy5zdGF0dXNUZXh0ID0gJ3N0YXR1c1RleHQnIGluIG9wdGlvbnMgPyBvcHRpb25zLnN0YXR1c1RleHQgOiAnT0snXG4gICAgdGhpcy5oZWFkZXJzID0gbmV3IEhlYWRlcnMob3B0aW9ucy5oZWFkZXJzKVxuICAgIHRoaXMudXJsID0gb3B0aW9ucy51cmwgfHwgJydcbiAgICB0aGlzLl9pbml0Qm9keShib2R5SW5pdClcbiAgfVxuXG4gIEJvZHkuY2FsbChSZXNwb25zZS5wcm90b3R5cGUpXG5cbiAgUmVzcG9uc2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZSh0aGlzLl9ib2R5SW5pdCwge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN0YXR1c1RleHQ6IHRoaXMuc3RhdHVzVGV4dCxcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKHRoaXMuaGVhZGVycyksXG4gICAgICB1cmw6IHRoaXMudXJsXG4gICAgfSlcbiAgfVxuXG4gIFJlc3BvbnNlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3BvbnNlID0gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IDAsIHN0YXR1c1RleHQ6ICcnfSlcbiAgICByZXNwb25zZS50eXBlID0gJ2Vycm9yJ1xuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgdmFyIHJlZGlyZWN0U3RhdHVzZXMgPSBbMzAxLCAzMDIsIDMwMywgMzA3LCAzMDhdXG5cbiAgUmVzcG9uc2UucmVkaXJlY3QgPSBmdW5jdGlvbih1cmwsIHN0YXR1cykge1xuICAgIGlmIChyZWRpcmVjdFN0YXR1c2VzLmluZGV4T2Yoc3RhdHVzKSA9PT0gLTEpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHN0YXR1cyBjb2RlJylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHtzdGF0dXM6IHN0YXR1cywgaGVhZGVyczoge2xvY2F0aW9uOiB1cmx9fSlcbiAgfVxuXG4gIHNlbGYuSGVhZGVycyA9IEhlYWRlcnNcbiAgc2VsZi5SZXF1ZXN0ID0gUmVxdWVzdFxuICBzZWxmLlJlc3BvbnNlID0gUmVzcG9uc2VcblxuICBzZWxmLmZldGNoID0gZnVuY3Rpb24oaW5wdXQsIGluaXQpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgcmVxdWVzdCA9IG5ldyBSZXF1ZXN0KGlucHV0LCBpbml0KVxuICAgICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpXG5cbiAgICAgIHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgc3RhdHVzOiB4aHIuc3RhdHVzLFxuICAgICAgICAgIHN0YXR1c1RleHQ6IHhoci5zdGF0dXNUZXh0LFxuICAgICAgICAgIGhlYWRlcnM6IHBhcnNlSGVhZGVycyh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkgfHwgJycpXG4gICAgICAgIH1cbiAgICAgICAgb3B0aW9ucy51cmwgPSAncmVzcG9uc2VVUkwnIGluIHhociA/IHhoci5yZXNwb25zZVVSTCA6IG9wdGlvbnMuaGVhZGVycy5nZXQoJ1gtUmVxdWVzdC1VUkwnKVxuICAgICAgICB2YXIgYm9keSA9ICdyZXNwb25zZScgaW4geGhyID8geGhyLnJlc3BvbnNlIDogeGhyLnJlc3BvbnNlVGV4dFxuICAgICAgICByZXNvbHZlKG5ldyBSZXNwb25zZShib2R5LCBvcHRpb25zKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ05ldHdvcmsgcmVxdWVzdCBmYWlsZWQnKSlcbiAgICAgIH1cblxuICAgICAgeGhyLm9udGltZW91dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QobmV3IFR5cGVFcnJvcignTmV0d29yayByZXF1ZXN0IGZhaWxlZCcpKVxuICAgICAgfVxuXG4gICAgICB4aHIub3BlbihyZXF1ZXN0Lm1ldGhvZCwgcmVxdWVzdC51cmwsIHRydWUpXG5cbiAgICAgIGlmIChyZXF1ZXN0LmNyZWRlbnRpYWxzID09PSAnaW5jbHVkZScpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9IHRydWVcbiAgICAgIH1cblxuICAgICAgaWYgKCdyZXNwb25zZVR5cGUnIGluIHhociAmJiBzdXBwb3J0LmJsb2IpIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9ICdibG9iJ1xuICAgICAgfVxuXG4gICAgICByZXF1ZXN0LmhlYWRlcnMuZm9yRWFjaChmdW5jdGlvbih2YWx1ZSwgbmFtZSkge1xuICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihuYW1lLCB2YWx1ZSlcbiAgICAgIH0pXG5cbiAgICAgIHhoci5zZW5kKHR5cGVvZiByZXF1ZXN0Ll9ib2R5SW5pdCA9PT0gJ3VuZGVmaW5lZCcgPyBudWxsIDogcmVxdWVzdC5fYm9keUluaXQpXG4gICAgfSlcbiAgfVxuICBzZWxmLmZldGNoLnBvbHlmaWxsID0gdHJ1ZVxufSkodHlwZW9mIHNlbGYgIT09ICd1bmRlZmluZWQnID8gc2VsZiA6IHRoaXMpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgQ09MT1JfQ0xBU1NfQ09VTlQ6IDEwLFxuICAgIENPTE9SX0NMQVNTX01BUDoge1xuICAgICAgICAnc3ViQ2xhc3NPZic6ICdjb2xvci1jbGFzcy1zdWItY2xhc3Mtb2YnLFxuICAgICAgICAndHlwZSc6ICdjb2xvci1jbGFzcy10eXBlJ1xuICAgIH1cbn07XG5cbi8qKlxuICogQ29sb3JDb25maWd1cmF0b3IuXG4gKiBHZW5lcmF0ZSBjb2xvciB0ZW1wbGF0ZXMgZm9yIGdyYXBoIGVsZW1lbnRzLlxuICpcbiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnM6XG4gKiAgICAgIF9vcHRpb25zOiB7XG4gKiAgICAgICAgICBERUZBVUxUX1BBR0VfU0laRTogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTE9SX0NMQVNTX0NPVU5UOiBudW1iZXIsIFxuICogICAgICAgICAgTUFYX0xBQkVMX0xFTkdUSDogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTF9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBST1dfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ1JPU1NfTk9ERV9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19NQVA6IHtcbiAqICAgICAgICAgICAgICAnc3ViQ2xhc3NPZic6IHN0cmluZywgXG4gKiAgICAgICAgICAgICAgJ3R5cGUnOiBzdHJpbmdcbiAqICAgICAgICAgIH1cbiAqICAgICAgfVxuICpcbiAqIFB1YmxpYyBtZXRob2RzOlxuICogICAgICBnZXRDb2xvclRlbXBsYXRlKCk6IHsgY29sb3I6c3RyaW5nLCBjb2xvckZpbGw6c3RyaW5nLCBjb2xvckZvbnQ6c3RyaW5nLCBjb2xvckZpbGxGb2N1c2VkOnN0cmluZyB9XG4gKi9cbmZ1bmN0aW9uIENvbG9yQ29uZmlndXJhdG9yIChfb3B0aW9ucykge1xuICAgIHZhciBDT0xPUl9DTEFTU19DT1VOVCA9IChfb3B0aW9ucyAmJiBfb3B0aW9ucy5DT0xPUl9DTEFTU19DT1VOVCAhPSB1bmRlZmluZWQgPyBfb3B0aW9ucy5DT0xPUl9DTEFTU19DT1VOVCA6IGRlZmF1bHRPcHRpb25zLkNPTE9SX0NMQVNTX0NPVU5UKTtcbiAgICB2YXIgX2NvbG9yQ2xhc3NNYXAgPSAoX29wdGlvbnMgJiYgX29wdGlvbnMuQ09MT1JfQ0xBU1NfTUFQID8gX29wdGlvbnMuQ09MT1JfQ0xBU1NfTUFQIDogZGVmYXVsdE9wdGlvbnMuQ09MT1JfQ0xBU1NfTUFQKTtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgX2luZGV4ID0gMTtcblxuICAgIGZ1bmN0aW9uIF9pbml0ICgpIHtcbiAgICAgICAgX2luZGV4ID0gTWF0aC5yb3VuZCgxICsgTWF0aC5yYW5kb20oKSAqIChDT0xPUl9DTEFTU19DT1VOVCAtIDEpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGNvbG9yIHRlbXBsYXRlIGZvciBlbGVtZW50LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpZCAtIGlkIG9mIGVsZW1lbnRcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBDb2xvciB0ZW1wbGF0ZVxuICAgICAqL1xuICAgIHNlbGYuZ2V0Q29sb3JDbGFzc0ZvckVsZW1lbnQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgaWQgPSB2ZXJpZnlJZChpZCk7XG4gICAgICAgIGlmICghX2NvbG9yQ2xhc3NNYXBbaWRdKSBfY29sb3JDbGFzc01hcFtpZF0gPSBfZ2V0TmV4dENsYXNzKCk7XG4gICAgICAgIHJldHVybiBfY29sb3JDbGFzc01hcFtpZF07XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHZlcmlmeUlkIChpZCkge1xuICAgICAgICByZXR1cm4gaWQucmVwbGFjZSgvW15cXHdcXGRdL2dpLCAnLScpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXROZXh0Q2xhc3MgKCkge1xuICAgICAgICB2YXIgY2xhc3NOYW1lID0gJ2NvbG9yLWNsYXNzLScgKyBfaW5kZXgrKztcbiAgICAgICAgaWYgKF9pbmRleCA+IENPTE9SX0NMQVNTX0NPVU5UKSBfaW5kZXggPSAxO1xuICAgICAgICByZXR1cm4gY2xhc3NOYW1lO1xuICAgIH1cblxuICAgIF9pbml0KCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQ29sb3JDb25maWd1cmF0b3I7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQcm9taXNlID0gcmVxdWlyZSgnZXM2LXByb21pc2UnKS5Qcm9taXNlO1xucmVxdWlyZSgnd2hhdHdnLWZldGNoJyk7XG5cbnZhciBERUZBVUxUX1NFUlZFUl9VUkwgPSAnaHR0cDovL3ZpZXcuZWRnLnRvcGJyYWlkLm5ldC9lZGcvdGJsL3N3cCc7XG52YXIgREVGQVVMVF9CQVNFID0gJ2h0dHA6Ly9yZGZleC5vcmcvd2l0aEltcG9ydHM/dXJpPXVybjp4LWV2bi1wdWI6Zmlibyc7XG52YXIgREVGQVVMVF9WSUVXX0NMQVNTID0gJ3N3YTpOZWlnaGJvckdyYW1Qcm9wZXJ0aWVzRGF0YVNlcnZpY2UnO1xuXG4vKipcbiAqIERhdGFQcm92aWRlci5cbiAqIFByb3ZpZGVzIGRhdGEgZm9yIHRoZSBncmFwaC5cbiAqXG4gKiBDb25zdHJ1Y3RvciBwYXJhbWV0ZXJzOlxuICogICAgICBzZXJ2ZXJVUkw6IHN0cmluZ1xuICogICAgICBiYXNlOiBzdHJpbmdcbiAqICAgICAgdmlld0NsYXNzOiBzdHJpbmdcbiAqXG4gKiBQdWJsaWMgbWV0aG9kczpcbiAqICAgICAgZ2V0R3JhcGhEYXRhKGZvY3VzTm9kZTpzdHJpbmcsIHN1Y2Nlc3NDYWxsYmFjazogZnVuY3Rpb24sIGVycm9yQ2FsbGJhY2s6IGZ1bmN0aW9uKTogdm9pZFxuICovXG5mdW5jdGlvbiBEYXRhUHJvdmlkZXIgKHNlcnZlclVSTCwgYmFzZSwgdmlld0NsYXNzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLyoqXG4gICAgICogUHJpdmF0ZSBmdW5jdGlvbiB3aGljaCB1c2VkIGFzIGNvbnN0cnVjdG9yLlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gc2VydmVyVVJMIC0gVVJMIG9mIHRoZSBzZXJ2ZXJcbiAgICAgKiBAcGFyYW0gIHtTdHJpbmd9IGJhc2UgLSBCYXNlXG4gICAgICogQHBhcmFtICB7U3RyaW5nfSB2aWV3Q2xhc3MgLSBWaWV3IGNsYXNzXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2luaXRpYWxpemUoc2VydmVyVVJMLCBiYXNlLCB2aWV3Q2xhc3MpIHtcbiAgICAgICAgaWYgKCFzZXJ2ZXJVUkwpIHNlcnZlclVSTCA9IERFRkFVTFRfU0VSVkVSX1VSTDtcbiAgICAgICAgaWYgKCFiYXNlKSBiYXNlID0gREVGQVVMVF9CQVNFO1xuICAgICAgICBpZiAoIXZpZXdDbGFzcykgdmlld0NsYXNzID0gREVGQVVMVF9WSUVXX0NMQVNTO1xuXG4gICAgICAgIHNlbGYudmlld0NsYXNzID0gdmlld0NsYXNzO1xuICAgICAgICBzZWxmLmJhc2UgPSBiYXNlO1xuICAgICAgICBzZWxmLnNlcnZlclVSTCA9IHNlcnZlclVSTDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXF1ZXN0cyBhbmQgcmV0dXJucyBkYXRhLlxuICAgICAqIEBwYXJhbSAge1N0cmluZ30gZm9jdXNOb2RlIC0gRm9jdXNlIG5vZGUgaWRcbiAgICAgKiBAcGFyYW0gIHtmdW5jdGlvbn0gc3VjY2Vzc0NhbGxiYWNrIC0gSGFuZGxlclxuICAgICAqIEBwYXJhbSAge2Z1bmN0aW9ufSBlcnJvckNhbGxiYWNrIC0gSGFuZGxlclxuICAgICAqL1xuICAgIHNlbGYuZ2V0R3JhcGhEYXRhID0gZnVuY3Rpb24gKGZvY3VzTm9kZSwgc3VjY2Vzc0NhbGxiYWNrLCBlcnJvckNhbGxiYWNrKSB7XG5cbiAgICAgICAgaWYgKCF2aWV3Q2xhc3MpIHZpZXdDbGFzcyA9IERFRkFVTFRfVklFV19DTEFTUztcblxuICAgICAgICB2YXIgdXJsID0gc2VsZi5zZXJ2ZXJVUkwgKyAnPycgK1xuICAgICAgICAgICAgJ19iYXNlPScgKyBzZWxmLmJhc2UgKyAnJicgK1xuICAgICAgICAgICAgJ192aWV3Q2xhc3M9JyArIHNlbGYudmlld0NsYXNzICsgJyYnICtcbiAgICAgICAgICAgICdmb2N1c05vZGU9JyArIGVuY29kZVVSSUNvbXBvbmVudChmb2N1c05vZGUpO1xuICAgICAgICBmZXRjaCh1cmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAgICBjcmVkZW50aWFsczogJ3NhbWUtb3JpZ2luJyxcbiAgICAgICAgICAgIG1vZGU6ICdjb3JzJyxcbiAgICAgICAgICAgIGNhY2hlOiAnZGVmYXVsdCdcbiAgICAgICAgfSlcbiAgICAgICAgLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IocmVzcG9uc2Uuc3RhdHVzVGV4dCk7XG4gICAgICAgICAgICAgICAgZXJyb3IucmVzcG9uc2UgPSByZXNwb25zZTtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBlcnJvckNhbGxiYWNrKGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB9KS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgc3VjY2Vzc0NhbGxiYWNrKF9maWx0ZXJEYXRhKHJlc3BvbnNlKSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBJdCBpcyBmaWx0ZXJpbmcgcmVzcG9uc2UgZGF0YS4gSXQncyBuZWVkZWQgdG8gcmVtb3ZlIGR1cGxpY2F0ZSBub2Rlcy5cbiAgICAgKiBAcGFyYW0gIHtPYmplY3R9IGRhdGEgLSBEYXRhXG4gICAgICogQHJldHVybnMge09iamVjdH0gQ29ycmVjdGVkIGRhdGEhXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2ZpbHRlckRhdGEgKGRhdGEpIHtcbiAgICAgICAgdmFyIG5vZGVzID0gZGF0YS5ub2RlcztcblxuICAgICAgICB2YXIgbmV3Tm9kZXMgPSBbXTtcblxuICAgICAgICB2YXIgZmluZE5vZGVCeUlkID0gZnVuY3Rpb24gKG5vZGVJZCkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuZXdOb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChuZXdOb2Rlc1tpXS5pZCA9PT0gbm9kZUlkKSByZXR1cm4gbmV3Tm9kZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICBub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICB2YXIgYmFzZU5vZGUgPSBmaW5kTm9kZUJ5SWQobm9kZS5pZCk7XG4gICAgICAgICAgICBpZiAoIWJhc2VOb2RlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5jYW5FeHBhbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIG5ld05vZGVzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRhdGEubm9kZXMgPSBuZXdOb2RlcztcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBcbiAgICAvLyBIZXJlIHdlIGNhbGwgY29uc3RydWN0b3IgYWZ0ZXIgZGVmaW5pbmcgYWxsIGZ1bmN0aW9uc1xuICAgIF9pbml0aWFsaXplLmNhbGwoc2VsZiwgc2VydmVyVVJMLCBiYXNlLCB2aWV3Q2xhc3MpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERhdGFQcm92aWRlcjtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgam9pbnQgPSByZXF1aXJlKCdyYXBwaWQnKTtcbnZhciB1bmlxdWVJZCA9IHJlcXVpcmUoJ2xvZGFzaCcpLnVuaXF1ZUlkO1xudmFyIGNsb25lRGVlcCA9IHJlcXVpcmUoJ2xvZGFzaCcpLmNsb25lRGVlcDtcblxudmFyIGRlZmF1bHRPcHRpb25zID0geyBFTEVNRU5UX1dJRFRIOiAxMzAsIEVMRU1FTlRfSEVJR0hUOiAzMCwgRlVMTF9OT0RFX0xBQkVMUzogZmFsc2UgfTtcbi8qKlxuICogTm9kZSBvZiB0aGUgZ3JhcGguXG4gKiBJdCdzIGEgbW9kZWwgb2YgYSBncmFwaCBlbGVtZW50LlxuICpcbiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnNcbiAqICAgICAgZGF0YU1vZGVsOiB7XG4gKiAgICAgICAgICB0eXBlSWQ6IHN0cmluZyxcbiAqICAgICAgICAgIGxhYmVsOiBzdHJpbmcsXG4gKiAgICAgICAgICBjb2xvckNsYXNzOiBzdHJpbmcsXG4gKiAgICAgICAgICBmdWxsTm9kZUxhYmVsczogYm9vbGVhbixcbiAqICAgICAgfVxuICogICAgICBfb3B0aW9uczoge1xuICogICAgICAgICAgREVGQVVMVF9QQUdFX1NJWkU6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19DT1VOVDogbnVtYmVyLCBcbiAqICAgICAgICAgIE1BWF9MQUJFTF9MRU5HVEg6IG51bWJlcixcbiAqICAgICAgICAgIENPTF9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBST1dfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ1JPU1NfTk9ERV9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19NQVA6IHtcbiAqICAgICAgICAgICAgICAnc3ViQ2xhc3NPZic6IHN0cmluZywgXG4gKiAgICAgICAgICAgICAgJ3R5cGUnOiBzdHJpbmdcbiAqICAgICAgICAgIH1cbiAqICAgICAgfVxuICpcbiAqIFB1YmxpYyBwcm9wZXJ0aWVzOlxuICogICAgICBkYXRhTW9kZWw6IGFueVxuICogICAgICBwYXJlbnRFZGdlOiBFZGdlID0gbnVsbFxuICogICAgICBfZWRnZXM6IEVkZ2VbXSA9IFtdXG4gKiAgICAgIGV4cGFuZGVkOiBib29sZWFuID0gZmFsc2VcbiAqICAgICAgY3VzdG9tUG9zaXRpb246IGJvb2xlYW4gPSBmYWxzZVxuICogICAgICBoYXNQb3NpdGlvbjogYm9vbGVhbiA9IGZhbHNlXG4gKiAgICAgIGhpZGRlbjogYm9vbGVhbiA9IGZhbHNlXG4gKiAgICAgIHBhZ2luYXRpb246IFBhZ2luYXRpb25cbiAqICAgICAgdHlwZUlkOiBzdHJpbmdcbiAqICAgICAgZnVsbExhYmVsOiBib29sZWFuID0gZmFsc2VcbiAqXG4gKiBQdWJsaWMgbWV0aG9kczpcbiAqICAgICAgcmVpbml0KCk6IHZvaWRcbiAqICAgICAgc2V0TGF5b3V0KGxheW91dDogR3JhcGhMYXlvdXQpOiB2b2lkXG4gKiAgICAgIGlzUm9vdE5vZGUoKTogYm9vbGVhblxuICogICAgICBub2RlUGxhY2VtZW50KCk6IGJvb2xlYW5cbiAqICAgICAgZ2V0U2l6ZSgpOiB7IHdpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyfVxuICogICAgICBnZXRQYXJlbnQoKTogTm9kZVxuICogICAgICBnZXRQcmV2Tm9kZSgpOiBOb2RlIHwgQ3Jvc3NOb2RlXG4gKiAgICAgIGhhc0NoaWxkcmVuKCk6IGJvb2xlYW5cbiogICAgICAgZ2V0Q2hpbGRyZW4oZXhwYW5kQ3Jvc3NOb2Rlcz86IGJvb2xlYW4pOiAoTm9kZSB8IENyb3NzTm9kZSlbXVxuICogICAgICBnZXRWaXNpYmxlQ2hpbGRyZW4oZXhwYW5kQ3Jvc3NOb2Rlcz86IGJvb2xlYW4pOiAoTm9kZSB8IENyb3NzTm9kZSlbXVxuICogICAgICBwdXNoRWRnZShlZGdlOiBFZGdlKTogdm9pZGVcbiAqICAgICAgZ2V0RWRnZUJ5VHlwZSh0eXBlSWQ6IHN0cmluZylcbiAqICAgICAgZGlzY29ubmVjdEVkZ2UoZWRnZTogRWRnZSk6IHZvaWRcbiAqICAgICAgc2V0UGFnaW5hdGlvbihwYWdpbmF0aW9uOiBQYWdpbmF0aW9uKTogdm9pZFxuICogICAgICBnZXRQYWdpbmF0aW9uKCk6IFBhZ2luYXRpb25cbiAqICAgICAgc29ydEVkZ2VzKGNvbXBhcmF0b3I6IGZ1bmN0aW9uKTogdm9pZFxuICogICAgICBnZXREaXJlY3Rpb24oKTogYm9vbGVhblxuICogICAgICBnZXREaXJlY3Rpb25SZWxhdGl2ZVRvTm9kZShyZWxhdGl2ZU5vZGU6IE5vZGUpOiBib29sZWFuXG4gKiAgICAgIHNldENvbG9yQ2xhc3MoY29sb3JDbGFzczogc3RyaW5nKTogdm9pZFxuICogICAgICBnZXRDb2xvckNsYXNzKCk6IHN0cmluZ1xuICogICAgICBiYWRQb3NpdGlvbih2YWx1ZTogYm9vbGVhbik6IGJvb2xlYW5cbiAqICAgICAgYWRkSGlnaGxpZ2h0aW5nKCk6IHZvaWRcbiAqICAgICAgcmVtb3ZlSGlnaGxpZ2h0aW5nKCk6IHZvaWRcbiAqL1xuZnVuY3Rpb24gTm9kZSAoZGF0YU1vZGVsLCBfb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBFTEVNRU5UX1dJRFRIID0gX29wdGlvbnMgJiYgX29wdGlvbnMuRUxFTUVOVF9XSURUSCAhPSB1bmRlZmluZWQgPyBfb3B0aW9ucy5FTEVNRU5UX1dJRFRIIDogZGVmYXVsdE9wdGlvbnMuRUxFTUVOVF9XSURUSDtcbiAgICB2YXIgRUxFTUVOVF9IRUlHSFQgPSBfb3B0aW9ucyAmJiBfb3B0aW9ucy5FTEVNRU5UX0hFSUdIVCAhPSB1bmRlZmluZWQgPyBfb3B0aW9ucy5FTEVNRU5UX0hFSUdIVCA6IGRlZmF1bHRPcHRpb25zLkVMRU1FTlRfSEVJR0hUO1xuXG4gICAgam9pbnQuc2hhcGVzLmRldnMuTW9kZWwuYXBwbHkoc2VsZiwgW3tcbiAgICAgICAgaWQ6IHVuaXF1ZUlkKCdub2RlXycpLFxuICAgICAgICBzaXplOiB7d2lkdGg6IEVMRU1FTlRfV0lEVEgsIGhlaWdodDogRUxFTUVOVF9IRUlHSFR9LFxuICAgICAgICBpblBvcnRzOiBbJ2xlZnQnXSxcbiAgICAgICAgb3V0UG9ydHM6IFsncmlnaHQnXSxcbiAgICAgICAgYXR0cnM6IHtcbiAgICAgICAgICAgICcuaW5Qb3J0cyBjaXJjbGUnOiB7cjogMCwgbWFnbmV0OiAncGFzc2l2ZSd9LFxuICAgICAgICAgICAgJy5vdXRQb3J0cyBjaXJjbGUnOiB7cjogMCwgbWFnbmV0OiAncGFzc2l2ZSd9LFxuICAgICAgICAgICAgcmVjdDoge1xuICAgICAgICAgICAgICAgIHJ4OiAyMCxcbiAgICAgICAgICAgICAgICByeTogMTYwLFxuICAgICAgICAgICAgICAgICdzdHJva2Utd2lkdGgnOiAyXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy5sYWJlbCc6IHtcbiAgICAgICAgICAgICAgICAnZm9udC1zaXplJzogMTEsXG4gICAgICAgICAgICAgICAgdGV4dDogZGF0YU1vZGVsLmxhYmVsID8gZGF0YU1vZGVsLmxhYmVsIDogJ1VubmFtZWQnLFxuICAgICAgICAgICAgICAgIGZpbGw6ICcjMzMzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdjbGFzcyc6ICdib2R5ICcgKyAnZGVmYXVsdC1jb2xvci1jbGFzcydcbiAgICAgICAgfVxuICAgIH1dKTtcblxuICAgIHZhciBfbGF5b3V0ID0gbnVsbDtcbiAgICB2YXIgX2NvbG9yQ2xhc3MgPSBudWxsO1xuICAgIHZhciBfYmFkUG9zaXRpb24gPSBmYWxzZTtcbiAgICB2YXIgX2VkZ2VNYXAgPSB7fTtcblxuICAgIHNlbGYucGFnaW5hdGlvbiA9IG51bGw7XG4gICAgc2VsZi5kYXRhTW9kZWwgPSBkYXRhTW9kZWw7XG4gICAgc2VsZi5wYXJlbnRFZGdlID0gbnVsbDtcbiAgICBzZWxmLmVkZ2VzID0gW107XG4gICAgc2VsZi50eXBlSWQgPSBkYXRhTW9kZWwudHlwZUlkO1xuICAgIHNlbGYuc2V0KCdmdWxsTGFiZWwnLCBkYXRhTW9kZWwuZnVsbE5vZGVMYWJlbHMgfHwgZGVmYXVsdE9wdGlvbnMuRlVMTF9OT0RFX0xBQkVMUyk7XG5cbiAgICBzZWxmLnNldCgnZXhwYW5kZWQnLCBmYWxzZSk7XG4gICAgc2VsZi5zZXQoJ2N1c3RvbVBvc2l0aW9uJywgZmFsc2UpOyAvLyB0cnVlIGlmIG5vZGUgbW92ZWQgYnkgdXNlclxuICAgIHNlbGYuc2V0KCdoYXNQb3NpdGlvbicsIGZhbHNlKTsgLy8gdHJ1ZSBpZiBub2RlIGlzIGxvY2F0ZWQgb24gX2xheW91dCBhbmQgdGhlcmUgaXMgd2F5IGZyb20gaGltIHRvIHJvb3Qgbm9kZVxuICAgIHNlbGYuc2V0KCdoaWRkZW4nLCB0cnVlKTsgLy8gdHJ1ZSBpZiBub2RlIGhhcyBwb3NpdGlvbiwgYnV0IG5vdCBwcmVzZW50cyBvbiBncmFwaFxuICAgIFxuICAgIHNlbGYuY29uZmlndXJhdGlvblNldCA9IHtcbiAgICAgICAgZmlsdGVyVHlwZTogJ0FMTCcsIC8vIElOQ09NSU5HLCBPVVRHT0lOR1xuICAgICAgICBmaWx0ZXJLZXk6ICcnLFxuICAgICAgICB2aXNpYmlsaXR5TWFwOiB7fSxcbiAgICAgICAgdmlzaWJpbGl0eU1hcFJldmVyc2U6IHt9LFxuICAgIH07XG5cbiAgICBzZWxmLm9uKCdjaGFuZ2U6cG9zaXRpb24nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF9yZUJpbmRFZGdlcygpO1xuICAgIH0pO1xuXG4gICAgc2VsZi5vbignY2hhbmdlOmZ1bGxMYWJlbCcsIF9jYWxjdWxhdGVTaXplKTtcblxuICAgIHNlbGYucmVpbml0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIV9sYXlvdXQpIHJldHVybjtcblxuICAgICAgICBfcmVCaW5kRWRnZXMoKTtcblxuICAgICAgICBpZiAoX2xheW91dC5nZXRSb290Tm9kZSgpLmlkID09PSBzZWxmLmlkKSB7XG4gICAgICAgICAgICBzZWxmLmF0dHIoe1xuICAgICAgICAgICAgICAgIHJlY3Q6IHtcbiAgICAgICAgICAgICAgICAgICAgcng6IDEsXG4gICAgICAgICAgICAgICAgICAgIHJ5OiA1XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzZWxmLnNldENvbG9yQ2xhc3MoJ2ZvY3VzLW5vZGUnKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLnNldExheW91dCA9IGZ1bmN0aW9uIChsYXlvdXQpIHtcbiAgICAgICAgX2xheW91dCA9IGxheW91dDtcbiAgICB9O1xuXG4gICAgc2VsZi5pc1Jvb3ROb2RlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKF9sYXlvdXQgJiYgX2xheW91dC5nZXRSb290Tm9kZSgpLmlkID09PSBzZWxmLmlkKTtcbiAgICB9O1xuXG4gICAgc2VsZi5pc1JldmVyc2VEaXJlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudEVkZ2UuaXNSZXZlcnNlRGlyZWN0aW9uO1xuICAgIH07XG5cbiAgICBzZWxmLm5vZGVQbGFjZW1lbnQgPSBmdW5jdGlvbiAoKSB7IC8vIHRydWUgLSB3ZXN0OyBmYWxzZSAtIGVhc3Q7XG4gICAgICAgIHJldHVybiAodGhpcy5wYXJlbnRFZGdlICYmIHRoaXMucGFyZW50RWRnZS5nZXRPcmllbnRhdGlvbigpID8gdHJ1ZSA6IGZhbHNlKTtcbiAgICB9O1xuXG4gICAgc2VsZi5nZXRTaXplID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gc2VsZi5nZXQoJ3NpemUnKTtcbiAgICB9O1xuXG4gICAgc2VsZi5nZXRQYXJlbnQgPSBmdW5jdGlvbiAoKSB7IC8vIEl0IGNhbid0IGJlIGEgQ3Jvc3NOb2RlXG4gICAgICAgIGlmICghc2VsZi5wYXJlbnRFZGdlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgdmFyIHByZXZOb2RlID0gc2VsZi5nZXRQcmV2Tm9kZSgpO1xuICAgICAgICBpZiAoIXByZXZOb2RlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIChwcmV2Tm9kZSBpbnN0YW5jZW9mIENyb3NzTm9kZSA/IHByZXZOb2RlLmdldFBhcmVudCgpIDogcHJldk5vZGUpO1xuICAgIH07XG5cbiAgICBzZWxmLmdldFByZXZOb2RlID0gZnVuY3Rpb24gKCkgeyAvLyBJdCBjYW4gYmUgYSBDcm9zc05vZGVcbiAgICAgICAgaWYgKCFzZWxmLnBhcmVudEVkZ2UpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gc2VsZi5wYXJlbnRFZGdlLmdldE90aGVyRW5kKHNlbGYpO1xuICAgIH07XG5cbiAgICBzZWxmLmhhc0NoaWxkcmVuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gKHNlbGYuZWRnZXMgJiYgc2VsZi5lZGdlcy5sZW5ndGggPiAwKTtcbiAgICB9O1xuXG4gICAgc2VsZi5nZXRDaGlsZHJlbiA9IGZ1bmN0aW9uIChleHBhbmRDcm9zc05vZGVzKSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IFtdO1xuICAgICAgICBzZWxmLmVkZ2VzLmZvckVhY2goZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICAgICAgICAgIHZhciBjaGlsZCA9IChlZGdlLnNvdXJjZS5pZCA9PT0gc2VsZi5pZCA/IGVkZ2UudGFyZ2V0IDogZWRnZS5zb3VyY2UpO1xuICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgQ3Jvc3NOb2RlICYmIGV4cGFuZENyb3NzTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjaGlsZC5nZXRDaGlsZHJlbigpLmZvckVhY2goZnVuY3Rpb24gKGNobDIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChjaGwyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0VmlzaWJsZUNoaWxkcmVuID0gZnVuY3Rpb24gKGV4cGFuZENyb3NzTm9kZXMpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gW107XG4gICAgICAgIHNlbGYuZWRnZXMuZm9yRWFjaChmdW5jdGlvbiAoZWRnZSkge1xuICAgICAgICAgICAgdmFyIGNoaWxkID0gKGVkZ2Uuc291cmNlLmlkID09PSBzZWxmLmlkID8gZWRnZS50YXJnZXQgOiBlZGdlLnNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBDcm9zc05vZGUgJiYgZXhwYW5kQ3Jvc3NOb2Rlcykge1xuICAgICAgICAgICAgICAgIGNoaWxkLmdldENoaWxkcmVuKCkuZm9yRWFjaChmdW5jdGlvbiAoY2hsMikge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbi5wdXNoKGNobDIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghY2hpbGQuZ2V0KCdoaWRkZW4nKSkge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH07XG5cbiAgICBzZWxmLnB1c2hFZGdlID0gZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICAgICAgc2VsZi5lZGdlcy5wdXNoKGVkZ2UpO1xuICAgICAgICBfZWRnZU1hcFtlZGdlLnR5cGVJZCArIChlZGdlLmlzUmV2ZXJzZURpcmVjdGlvbiA/ICckJHJldmVyc2UnIDogJycpICsgKGVkZ2UuZ2V0T3JpZW50YXRpb24oKSA/ICckJHdlc3QnIDogJyQkZWFzdCcpXSA9IGVkZ2U7XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0RWRnZUJ5VHlwZSA9IGZ1bmN0aW9uICh0eXBlSWQsIGlzUmV2ZXJzZURpcmVjdGlvbiwgb3JpZW50YXRpb24pIHtcbiAgICAgICAgdmFyIHJlcyA9IF9lZGdlTWFwW3R5cGVJZCArIChpc1JldmVyc2VEaXJlY3Rpb24gPyAnJCRyZXZlcnNlJyA6ICcnKSArIChvcmllbnRhdGlvbiA/ICckJHdlc3QnIDogJyQkZWFzdCcpXTtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9O1xuXG4gICAgc2VsZi5kaXNjb25uZWN0RWRnZSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgICAgIGlmIChzZWxmLnBhcmVudEVkZ2UgPT09IGVkZ2UpIHtcbiAgICAgICAgICAgIHNlbGYucGFyZW50RWRnZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWxmLmVkZ2VzLnNwbGljZShzZWxmLmVkZ2VzLmluZGV4T2YoZWRnZSksIDEpO1xuICAgICAgICAgICAgX2VkZ2VNYXBbZWRnZS50eXBlSWQgKyAoZWRnZS5pc1JldmVyc2VEaXJlY3Rpb24gPyAnJCRyZXZlcnNlJyA6ICcnKSArIChlZGdlLmdldE9yaWVudGF0aW9uKCkgPyAnJCR3ZXN0JyA6ICckJGVhc3QnKV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYuc2V0UGFnaW5hdGlvbiA9IGZ1bmN0aW9uIChwYWdpbmF0aW9uKSB7XG4gICAgICAgIHNlbGYucGFnaW5hdGlvbiA9IHBhZ2luYXRpb247XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0UGFnaW5hdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYucGFnaW5hdGlvbjtcbiAgICB9O1xuXG4gICAgc2VsZi5zb3J0RWRnZXMgPSBmdW5jdGlvbiAoY29tcGFyYXRvcikge1xuICAgICAgICBpZiAoc2VsZi5lZGdlcykgc2VsZi5lZGdlcy5zb3J0KGNvbXBhcmF0b3IpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHBvc2l0aW9uIHJlbGF0aXZlIHRvIGNlbnRlclxuICAgICAqIGZhbHNlID0+IG9uIHRoZSBsZWZ0IG9mIHRoZSBjZW50ZXJcbiAgICAgKiB0cnVlID0+IG9uIHRoZSByaWdodCBvZiB0aGUgY2VudGVyXG4gICAgICovXG4gICAgc2VsZi5nZXREaXJlY3Rpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByb290Tm9kZSA9IF9nZXRSb290Rm9yTm9kZShzZWxmKTtcbiAgICAgICAgaWYgKHJvb3ROb2RlICYmIHJvb3ROb2RlICE9PSBzZWxmKSB7XG4gICAgICAgICAgICByZXR1cm4gKF9sYXlvdXQgJiYgc2VsZi5wb3NpdGlvbigpLnggPj0gcm9vdE5vZGUucG9zaXRpb24oKS54KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAhc2VsZi5ub2RlUGxhY2VtZW50KCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgbm9kZVxuICAgICAqIGZhbHNlID0+IG9uIHRoZSBsZWZ0IG9mIHRoZSByZWxhdGl2ZU5vZGVcbiAgICAgKiB0cnVlID0+IG9uIHRoZSByaWdodCBvZiB0aGUgcmVsYXRpdmVOb2RlXG4gICAgICovXG4gICAgc2VsZi5nZXREaXJlY3Rpb25SZWxhdGl2ZVRvTm9kZSA9IGZ1bmN0aW9uIChyZWxhdGl2ZU5vZGUpIHtcbiAgICAgICAgcmV0dXJuIChyZWxhdGl2ZU5vZGUgJiYgc2VsZi5wb3NpdGlvbigpLnggPiByZWxhdGl2ZU5vZGUucG9zaXRpb24oKS54KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0cyBuZXcgY29sb3IgY2xhc3MgZm9yIG5vZGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29sb3JDbGFzcyAtIGNzcyBjbGFzc1xuICAgICAqL1xuICAgIHNlbGYuc2V0Q29sb3JDbGFzcyA9IGZ1bmN0aW9uIChjb2xvckNsYXNzKSB7XG4gICAgICAgIGlmIChjb2xvckNsYXNzICE9IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgX2NvbG9yQ2xhc3MgPSBjb2xvckNsYXNzO1xuICAgICAgICAgICAgc2VsZi5kYXRhTW9kZWwuY29sb3JDbGFzcyA9IGNvbG9yQ2xhc3M7XG4gICAgICAgIH1cbiAgICAgICAgX3JlZnJlc2hDb2xvckNsYXNzKCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgY29sb3IgY2xhc3NcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBjb2xvciBjbGFzc1xuICAgICAqL1xuICAgIHNlbGYuZ2V0Q29sb3JDbGFzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF9jb2xvckNsYXNzO1xuICAgIH07XG5cbiAgICBzZWxmLmJhZFBvc2l0aW9uID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIF9iYWRQb3NpdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgX3JlZnJlc2hDb2xvckNsYXNzKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9iYWRQb3NpdGlvbjtcbiAgICB9O1xuICAgIFxuICAgIHNlbGYuYWRkSGlnaGxpZ2h0aW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmF0dHIoJ3JlY3Qvc3Ryb2tlLXdpZHRoJywgNCk7XG4gICAgfTtcbiAgICBcbiAgICBzZWxmLnJlbW92ZUhpZ2hsaWdodGluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5hdHRyKCdyZWN0L3N0cm9rZS13aWR0aCcsIDIpO1xuICAgIH07XG5cbiAgICBzZWxmLnNldFBhcmVudCA9IGZ1bmN0aW9uIChwYXJlbnRFZGdlKSB7XG4gICAgICAgIHNlbGYucGFyZW50RWRnZSA9IHBhcmVudEVkZ2U7XG4gICAgICAgIC8vIGdldHRpbmcgdGhlIGNvbmZpZ3VyYXRpb25TZXQgZnJvbSBwYXJlbnRcbiAgICAgICAgdmFyIHBhcmVudCA9IHNlbGYuZ2V0UGFyZW50KCk7XG4gICAgICAgIGlmIChwYXJlbnQgJiYgIXNlbGYuY29uZmlndXJhdGlvblNldC5tb2RpZmllZCkge1xuICAgICAgICAgICAgc2VsZi5jb25maWd1cmF0aW9uU2V0ID0gY2xvbmVEZWVwKHBhcmVudC5jb25maWd1cmF0aW9uU2V0KTtcbiAgICAgICAgICAgIHNlbGYuY29uZmlndXJhdGlvblNldC5jb25uZWN0aW9ucyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIHNlbGYuY29uZmlndXJhdGlvblNldC5tb2RpZmllZCA9IGZhbHNlO1xuICAgICAgICAgICAgc2VsZi5jb25maWd1cmF0aW9uU2V0LmV4cGFuZFRyYW5zaXRpdmVseSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIF9nZXRSb290Rm9yTm9kZSAobm9kZSkge1xuICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgIGlmIChub2RlLmlzUm9vdE5vZGUoKSB8fCBub2RlLmdldCgnY3VzdG9tUG9zaXRpb24nKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gX2dldFJvb3RGb3JOb2RlKG5vZGUuZ2V0UGFyZW50KCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlZnJlc2hDb2xvckNsYXNzICgpIHtcbiAgICAgICAgaWYgKCFfYmFkUG9zaXRpb24pIHtcbiAgICAgICAgICAgIHNlbGYuYXR0cih7XG4gICAgICAgICAgICAgICAgcmVjdDoge1xuICAgICAgICAgICAgICAgICAgICAnY2xhc3MnOiAnYm9keSAnICsgX2NvbG9yQ2xhc3NcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHNlbGYuc2V0KCd6JywgMTAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuYXR0cih7XG4gICAgICAgICAgICAgICAgcmVjdDoge1xuICAgICAgICAgICAgICAgICAgICAnY2xhc3MnOiAnYm9keSAnICsgX2NvbG9yQ2xhc3MgKyAnIGJhZC1ub2RlLXBvc2l0aW9uJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgc2VsZi5zZXQoJ3onLCAyMDApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2NhbGN1bGF0ZVNpemUgKCkge1xuICAgICAgICBpZiAoIXNlbGYuZGF0YU1vZGVsLmxhYmVsKSByZXR1cm47XG4gICAgICAgIHZhciBsYWJlbCA9IHNlbGYuZGF0YU1vZGVsLmxhYmVsO1xuICAgICAgICB2YXIgd3JhcHRleHQgPSBqb2ludC51dGlsLmJyZWFrVGV4dChsYWJlbCwge1xuICAgICAgICAgICAgd2lkdGg6IHNlbGYuZ2V0U2l6ZSgpLndpZHRoXG4gICAgICAgIH0pO1xuICAgICAgICB2YXIgcm93cyA9IHdyYXB0ZXh0LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgaWYgKHNlbGYuZ2V0KCdmdWxsTGFiZWwnKSkge1xuICAgICAgICAgICAgc2VsZi5hdHRyKHtcbiAgICAgICAgICAgICAgICAnLmxhYmVsJzoge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0OiB3cmFwdGV4dFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdmFyIHJvd0NvdW50ID0gcm93cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgdmFyIHNlbGZTaXplID0gc2VsZi5nZXRTaXplKCk7XG4gICAgICAgICAgICB2YXIgZm9udFNpemUgPSBzZWxmLmF0dHJpYnV0ZXMuYXR0cnNbJy5sYWJlbCddWydmb250LXNpemUnXTtcbiAgICAgICAgICAgIHNlbGYucmVzaXplKHNlbGZTaXplLndpZHRoLCBzZWxmU2l6ZS5oZWlnaHQgKyByb3dDb3VudCAqIGZvbnRTaXplKTtcbiAgICAgICAgICAgIHNlbGZTaXplID0gc2VsZi5nZXRTaXplKCk7XG4gICAgICAgICAgICBpZiAoX2xheW91dCAmJiBfbGF5b3V0LmdldFJvb3ROb2RlKCkuaWQgPT09IHNlbGYuaWQpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmF0dHIoe1xuICAgICAgICAgICAgICAgICAgICByZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByeDogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ5OiA1LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2NsYXNzJzogJ2JvZHkgJyArICcgZm9jdXMtbm9kZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLmF0dHIoe1xuICAgICAgICAgICAgICAgICAgICByZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByeDogMjAsXG4gICAgICAgICAgICAgICAgICAgICAgICByeTogMjAgKiAoc2VsZlNpemUud2lkdGggLyBzZWxmU2l6ZS5oZWlnaHQpICogMlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNlbGYuYXR0cih7XG4gICAgICAgICAgICAgICAgJy5sYWJlbCc6IHtcbiAgICAgICAgICAgICAgICAgICAgdGV4dDogKHJvd3MubGVuZ3RoID09PSAxID8gbGFiZWwgOiBsYWJlbC5zdWJzdHJpbmcoMCwgd3JhcHRleHQuaW5kZXhPZignXFxuJykpICsgJy4uLicpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBzZWxmLnJlc2l6ZShFTEVNRU5UX1dJRFRILCBFTEVNRU5UX0hFSUdIVCk7XG4gICAgICAgICAgICBpZiAoX2xheW91dCAmJiBfbGF5b3V0LmdldFJvb3ROb2RlKCkuaWQgPT09IHNlbGYuaWQpIHtcbiAgICAgICAgICAgICAgICBzZWxmLmF0dHIoe1xuICAgICAgICAgICAgICAgICAgICByZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByeDogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ5OiA1LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ2NsYXNzJzogJ2JvZHkgJyArICcgZm9jdXMtbm9kZSdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZWxmLmF0dHIoe1xuICAgICAgICAgICAgICAgICAgICByZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByeDogMjAsXG4gICAgICAgICAgICAgICAgICAgICAgICByeTogMTYwXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBfY2FsY3VsYXRlU2l6ZSgpO1xuXG4gICAgZnVuY3Rpb24gX3JlQmluZEVkZ2VzICgpIHtcbiAgICAgICAgdmFyIHJlYmluZCA9IGZ1bmN0aW9uIChlZGdlLCBkaXJlY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBlZGdlLnNldCgnc291cmNlJywge2lkOiBlZGdlLmdldCgnc291cmNlJykuaWQsIHBvcnQ6ICdsZWZ0J30pO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0KCd0YXJnZXQnLCB7aWQ6IGVkZ2UuZ2V0KCd0YXJnZXQnKS5pZCwgcG9ydDogJ3JpZ2h0J30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlZGdlLnNldCgndGFyZ2V0Jywge2lkOiBlZGdlLmdldCgndGFyZ2V0JykuaWQsIHBvcnQ6ICdsZWZ0J30pO1xuICAgICAgICAgICAgICAgIGVkZ2Uuc2V0KCdzb3VyY2UnLCB7aWQ6IGVkZ2UuZ2V0KCdzb3VyY2UnKS5pZCwgcG9ydDogJ3JpZ2h0J30pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpZiAoc2VsZi5wYXJlbnRFZGdlKSByZWJpbmQoc2VsZi5wYXJlbnRFZGdlLCBzZWxmLmdldFByZXZOb2RlKCkucG9zaXRpb24oKS54ID4gc2VsZi5wb3NpdGlvbigpLngpO1xuICAgICAgICBpZiAoc2VsZi5lZGdlcykgc2VsZi5lZGdlcy5mb3JFYWNoKGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgICAgICAgICByZWJpbmQoZWRnZSwgZWRnZS5nZXRPdGhlckVuZChzZWxmKS5wb3NpdGlvbigpLnggPD0gc2VsZi5wb3NpdGlvbigpLngpO1xuICAgICAgICB9KTtcbiAgICB9XG59XG5Ob2RlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoam9pbnQuc2hhcGVzLmRldnMuTW9kZWwucHJvdG90eXBlKTtcblxuLyoqXG4gKiBDcm9zc05vZGUgb2YgdGhlIGdyYXBoLlxuICogSXQncyBhIG1vZGVsIG9mIGEgZ3JhcGggZWxlbWVudC4gRXh0ZW5kIG9mIE5vZGUuXG4gKlxuICogQ29uc3RydWN0b3IgcGFyYW1ldGVyczpcbiAqICAgICAgY29sb3JDbGFzczogc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIENyb3NzTm9kZSAoY29sb3JDbGFzcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgREVGQVVMVF9DUk9TU19OT0RFX09GRlNFVCA9IDMwOyAvLyBJdCBkZWZpbmVzIG9mZnNldCBvZiB0aGUgY3Jvc3Mgbm9kZSByZWxhdGl2ZSB0byB0aGUgbmV4dCBjb2x1bW4gcG9zaXRpb25cbiAgICBOb2RlLmFwcGx5KHNlbGYsIFt7dHlwZUlkOiAnY3Jvc3NOb2RlJ31dKTtcblxuICAgIHNlbGYucmVzaXplKDUsIDUpO1xuICAgIHNlbGYuYXR0cih7XG4gICAgICAgIHJlY3Q6IHtcbiAgICAgICAgICAgIHJ4OiA1MDAsXG4gICAgICAgICAgICByeTogNTAwLFxuICAgICAgICAgICAgJ3N0cm9rZS13aWR0aCc6IDJcbiAgICAgICAgfSxcbiAgICAgICAgJy5sYWJlbCc6IHtcbiAgICAgICAgICAgIHRleHQ6ICcnXG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBzZWxmLnJlaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICB9O1xuICAgIHNlbGYuc2V0Q29sb3JDbGFzcyhjb2xvckNsYXNzKTtcblxuICAgIHNlbGYuZ2V0RWRnZUJ5VHlwZSA9IGZ1bmN0aW9uICh0eXBlSWQpIHtcbiAgICAgICAgc2VsZi5lZGdlcy5maWx0ZXIoZnVuY3Rpb24gKGVkZ2UpIHsgcmV0dXJuIGVkZ2UudHlwZUlkID09PSB0eXBlSWQ7IH0pWzBdO1xuICAgIH07XG5cbiAgICBzZWxmLmFsaWduUmVsYXRpdmVUb0NoaWxkcmVuID0gZnVuY3Rpb24gKENST1NTX05PREVfT0ZGU0VUKSB7XG4gICAgICAgIHZhciBvZmZzZXQgPSAoQ1JPU1NfTk9ERV9PRkZTRVQgIT0gdW5kZWZpbmVkID8gQ1JPU1NfTk9ERV9PRkZTRVQgOiBERUZBVUxUX0NST1NTX05PREVfT0ZGU0VUKTtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gc2VsZi5nZXRWaXNpYmxlQ2hpbGRyZW4oKTtcbiAgICAgICAgdmFyIGZpbHRlcmVkQ2hpbGRyZW4gPSBjaGlsZHJlbi5maWx0ZXIoZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgICAgICByZXR1cm4gIWNoLmdldCgnY3VzdG9tUG9zaXRpb24nKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChmaWx0ZXJlZENoaWxkcmVuLmxlbmd0aCA9PT0gMCAmJiBjaGlsZHJlbi5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgIGZpbHRlcmVkQ2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgICAgfSBlbHNlIGlmIChjaGlsZHJlbi5sZW5ndGggPT09IDApIHJldHVybjtcbiAgICAgICAgdmFyIGZpcnN0Q2hpZWxkID0gZmlsdGVyZWRDaGlsZHJlblswXTtcbiAgICAgICAgdmFyIGxhc3RDaGllbGQgPSBmaWx0ZXJlZENoaWxkcmVuW2ZpbHRlcmVkQ2hpbGRyZW4ubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBmaXJzdENoaWxkUG9zID0gZmlyc3RDaGllbGQucG9zaXRpb24oKTtcbiAgICAgICAgdmFyIGxhc3RDaGllbGRQb3MgPSBsYXN0Q2hpZWxkLnBvc2l0aW9uKCk7XG4gICAgICAgIHZhciBsYXN0Q2hpZWxkU2l6ZSA9IGZpcnN0Q2hpZWxkLmdldFNpemUoKTtcbiAgICAgICAgdmFyIHggPSBmaXJzdENoaWxkUG9zLng7XG4gICAgICAgIHZhciB5ID0gKGxhc3RDaGllbGRQb3MueSArIGZpcnN0Q2hpbGRQb3MueSArIGxhc3RDaGllbGRTaXplLmhlaWdodCAtIHNlbGYuZ2V0U2l6ZSgpLmhlaWdodCkgLyAyO1xuICAgICAgICBpZiAoIXNlbGYubm9kZVBsYWNlbWVudCgpKSB4IC09IG9mZnNldDtcbiAgICAgICAgaWYgKHNlbGYubm9kZVBsYWNlbWVudCgpKSB4ICs9IGxhc3RDaGllbGRTaXplLndpZHRoICsgb2Zmc2V0O1xuICAgICAgICBzZWxmLnBvc2l0aW9uKHgsIHkpO1xuICAgIH07XG5cbn1cbkNyb3NzTm9kZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKE5vZGUucHJvdG90eXBlKTtcblxuLyoqXG4gKiBFZGdlIG9mIHRoZSBncmFwaC5cbiAqIEl0J3MgYSBtb2RlbCBvZiBhIGdyYXBoIGxpbmsuXG4gKlxuICogQ29uc3RydWN0b3IgcGFyYW1ldGVyczpcbiAqICAgICAgZGF0YU1vZGVsOiB7XG4gKiAgICAgICAgICB0eXBlSWQ6IHN0cmluZ1xuICogICAgICAgICAgc291cmNlVHlwZUlkOiBzdHJpbmcsXG4gKiAgICAgICAgICB0YXJnZXRUeXBlSWQ6IHN0cmluZyxcbiAqICAgICAgICAgIGxhYmVsOiBzdHJpbmcsXG4gKiAgICAgICAgICBjb2xvclRlbXBsYXRlPzoge1xuICogICAgICAgICAgICAgIGNvbG9yOiBzdHJpbmcsIFxuICogICAgICAgICAgICAgIGNvbG9yRmlsbDogc3RyaW5nLCBcbiAqICAgICAgICAgICAgICBjb2xvckZvbnQ6IHN0cmluZyxcbiAqICAgICAgICAgICAgICBjb2xvckZpbGxGb2N1c2VkOiBzdHJpbmdcbiAqICAgICAgICAgIH0sXG4gKiAgICAgICAgICBpc1JldmVyc2VEaXJlY3Rpb24/OiBib29sZWFuLFxuICogICAgICB9XG4gKlxuICogUHVibGljIHByb3BlcnRpZXM6XG4gKiAgICAgIGRhdGFNb2RlbDoge2RhdGFNb2RlbH1cbiAqICAgICAgc291cmNlOiBOb2RlXG4gKiAgICAgIHRhcmdldDogTm9kZVxuICogICAgICB0eXBlSWQ6IHN0cmluZ1xuICogICAgICBzb3VyY2VUeXBlSWQ6IHN0cmluZ1xuICogICAgICB0YXJnZXRUeXBlSWQ6IHN0cmluZ1xuICpcbiAqIFB1YmxpYyBtZXRob2RzOlxuICogICAgICBnZXRPdGhlckVuZChtZTogTm9kZSk6IE5vZGVcbiAqICAgICAgZ2V0T3JpZW50YXRpb24oKTogYm9vbGVhbiAgLy8gdHJ1ZSAtIHdlc3Q7IGZhbHNlIC0gZWFzdDtcbiAqICAgICAgc2V0U291cmNlKHNvdXJjZTogTm9kZSwgaXNQYXJlbnQ6IGJvb2xlYW4sIHBvcnQ6IHN0cmluZyk6IHZvaWRcbiAqICAgICAgc2V0VGFyZ2V0KHNvdXJjZTogTm9kZSwgaXNQYXJlbnQ6IGJvb2xlYW4sIHBvcnQ6IHN0cmluZyk6IHZvaWRcbiAqICAgICAgZGlzY29ubmVjdCgpOiB2b2lkXG4gKiAgICAgIHJldmVyc2VFZGdlRGlyZWN0aW9uKCk6IHZvaWRcbiAqICAgICAgc2V0Q29sb3JDbGFzcyhjb2xvckNsYXNzOiBzdHJpbmcpOiB2b2lkXG4gKi9cbmZ1bmN0aW9uIEVkZ2UgKGRhdGFNb2RlbCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGpvaW50LmRpYS5MaW5rLmFwcGx5KHNlbGYsIFt7XG4gICAgICAgIHo6IDAsXG4gICAgICAgIHNvdXJjZToge2lkOiBudWxsLCBwb3J0OiAncmlnaHQnfSxcbiAgICAgICAgdGFyZ2V0OiB7aWQ6IG51bGwsIHBvcnQ6ICdsZWZ0J30sXG4gICAgICAgIC8vIHNtb290aDogdHJ1ZSxcbiAgICAgICAgLy8gcm91dGVyOiB7IG5hbWU6ICdvcnRob2dvbmFsJyB9LFxuICAgICAgICAvLyByb3V0ZXI6IHsgbmFtZTogJ21ldHJvJyB9LFxuICAgICAgICAvLyBjb25uZWN0b3I6IHsgbmFtZTogJ3JvdW5kZWQnIH0sXG4gICAgICAgIGF0dHJzOiB7XG4gICAgICAgICAgICAnLmNvbm5lY3Rpb24nOiB7XG4gICAgICAgICAgICAgICAgJ3N0cm9rZS13aWR0aCc6IDIsXG4gICAgICAgICAgICAgICAgJ2NsYXNzJzogJ2Nvbm5lY3Rpb24gJyArIChkYXRhTW9kZWwuY29sb3JDbGFzcyA/IGRhdGFNb2RlbC5jb2xvckNsYXNzIDogJ2RlZmF1bHQtY29sb3ItY2xhc3MnKVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBsYWJlbHM6IFt7XG4gICAgICAgICAgICBwb3NpdGlvbjogMC41LFxuICAgICAgICAgICAgYXR0cnM6IHtcbiAgICAgICAgICAgICAgICB0ZXh0OiB7XG4gICAgICAgICAgICAgICAgICAgICdjbGFzcyc6IChkYXRhTW9kZWwuY29sb3JDbGFzcyA/IGRhdGFNb2RlbC5jb2xvckNsYXNzIDogJ2RlZmF1bHQtY29sb3ItY2xhc3MnKSxcbiAgICAgICAgICAgICAgICAgICAgJ2ZvbnQtZmFtaWx5JzogJ0FyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWYnLFxuICAgICAgICAgICAgICAgICAgICAnZm9udC1zaXplJzogMTEsXG4gICAgICAgICAgICAgICAgICAgIHRleHQ6IGRhdGFNb2RlbC5sYWJlbFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfV1cbiAgICB9XSk7XG5cbiAgICBzZWxmLmlzUmV2ZXJzZURpcmVjdGlvbiA9IGZhbHNlO1xuICAgIHNlbGYuc291cmNlID0gbnVsbDtcbiAgICBzZWxmLnRhcmdldCA9IG51bGw7XG4gICAgc2VsZi5kYXRhTW9kZWwgPSBkYXRhTW9kZWw7XG4gICAgc2VsZi5zb3VyY2VUeXBlSWQgPSBkYXRhTW9kZWwuc291cmNlVHlwZUlkO1xuICAgIHNlbGYudGFyZ2V0VHlwZUlkID0gZGF0YU1vZGVsLnRhcmdldFR5cGVJZDtcbiAgICBzZWxmLnR5cGVJZCA9IGRhdGFNb2RlbC50eXBlSWQ7XG4gICAgc2VsZi5wbGFjZW1lbnQgPSBkYXRhTW9kZWwucGxhY2VtZW50O1xuXG4gICAgc2VsZi5nZXRPdGhlckVuZCA9IGZ1bmN0aW9uIChtZSkge1xuICAgICAgICByZXR1cm4gKG1lLmlkID09PSBzZWxmLnNvdXJjZS5pZCA/IHNlbGYudGFyZ2V0IDogc2VsZi5zb3VyY2UpO1xuICAgIH07XG5cbiAgICBzZWxmLnNldFNvdXJjZSA9IGZ1bmN0aW9uIChzb3VyY2UsIGlzUGFyZW50LCBwb3J0KSB7XG4gICAgICAgIHNlbGYuc2V0KCdzb3VyY2UnLCB7aWQ6IHNvdXJjZS5pZCwgcG9ydDogcG9ydH0pO1xuICAgICAgICBzZWxmLnNvdXJjZSA9IHNvdXJjZTtcbiAgICAgICAgaWYgKGlzUGFyZW50KSB7XG4gICAgICAgICAgICBzZWxmLnNvdXJjZS5wdXNoRWRnZShzZWxmKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYuc291cmNlLnNldFBhcmVudChzZWxmKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLnNldFRhcmdldCA9IGZ1bmN0aW9uICh0YXJnZXQsIGlzUGFyZW50LCBwb3J0KSB7XG4gICAgICAgIHNlbGYuc2V0KCd0YXJnZXQnLCB7aWQ6IHRhcmdldC5pZCwgcG9ydDogcG9ydH0pO1xuICAgICAgICBzZWxmLnRhcmdldCA9IHRhcmdldDtcbiAgICAgICAgaWYgKGlzUGFyZW50KSB7XG4gICAgICAgICAgICBzZWxmLnRhcmdldC5wdXNoRWRnZShzZWxmKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGYudGFyZ2V0LnNldFBhcmVudChzZWxmKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYudGFyZ2V0LmRpc2Nvbm5lY3RFZGdlKHNlbGYpO1xuICAgICAgICBzZWxmLnNvdXJjZS5kaXNjb25uZWN0RWRnZShzZWxmKTtcbiAgICAgICAgc2VsZi5yZW1vdmUoKTtcbiAgICB9O1xuXG4gICAgc2VsZi5zZXRDb2xvckNsYXNzID0gZnVuY3Rpb24gKGNvbG9yQ2xhc3MpIHtcbiAgICAgICAgc2VsZi5hdHRyKHtcbiAgICAgICAgICAgICcuY29ubmVjdGlvbic6IHtcbiAgICAgICAgICAgICAgICAnY2xhc3MnOiAnY29ubmVjdGlvbiAnICsgY29sb3JDbGFzc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICcubWFya2VyLXRhcmdldCc6IHtcbiAgICAgICAgICAgICAgICAnY2xhc3MnOiBjb2xvckNsYXNzXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJy5tYXJrZXItc291cmNlJzoge1xuICAgICAgICAgICAgICAgICdjbGFzcyc6IGNvbG9yQ2xhc3NcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLmRhdGFNb2RlbC5jb2xvckNsYXNzID0gY29sb3JDbGFzcztcbiAgICB9O1xuXG4gICAgc2VsZi5nZXRPcmllbnRhdGlvbiA9IGZ1bmN0aW9uICgpIHsgLy8gdHJ1ZSAtIHdlc3Q7IGZhbHNlIC0gZWFzdDtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICAgc2VsZi5wbGFjZW1lbnQgJiZcbiAgICAgICAgICAgIChzZWxmLnBsYWNlbWVudCA9PT0gJ2ZvcndhcmQnIHx8IHNlbGYucGxhY2VtZW50ID09PSAnYmFja3dhcmQnKVxuICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmlzUmV2ZXJzZURpcmVjdGlvbiAmJlxuICAgICAgICAgICAgICAgICAgIHNlbGYucGxhY2VtZW50ID09PSAnZm9yd2FyZCcgfHxcbiAgICAgICAgICAgICAgICAgICAhc2VsZi5pc1JldmVyc2VEaXJlY3Rpb24gJiZcbiAgICAgICAgICAgICAgICAgICBzZWxmLnBsYWNlbWVudCA9PT0gJ2JhY2t3YXJkJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzZWxmLmlzUmV2ZXJzZURpcmVjdGlvbjtcbiAgICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb25zIHdoaWNoIHJldmVyc2VzIHRoZSBkaXJlY3Rpb24gXG4gICAgICogb2YgdGhlIEVkZ2UgKEZvciB0aGUgZmlyc3QgaXRlcmF0aW9uKVxuICAgICAqL1xuICAgIHNlbGYucmV2ZXJzZUVkZ2VEaXJlY3Rpb24gPSBmdW5jdGlvbiAoaXNSZXZlcnNlRGlyZWN0aW9uKSB7XG4gICAgICAgIGlmIChzZWxmLmlzUmV2ZXJzZURpcmVjdGlvbiAhPT0gaXNSZXZlcnNlRGlyZWN0aW9uKSB7XG4gICAgICAgICAgICBzZWxmLmlzUmV2ZXJzZURpcmVjdGlvbiA9IGlzUmV2ZXJzZURpcmVjdGlvbjtcbiAgICAgICAgICAgIHZhciB0YXJnZXRJZCA9IHNlbGYudGFyZ2V0VHlwZUlkO1xuICAgICAgICAgICAgc2VsZi50YXJnZXRUeXBlSWQgPSBzZWxmLnNvdXJjZVR5cGVJZDtcbiAgICAgICAgICAgIHNlbGYuc291cmNlVHlwZUlkID0gdGFyZ2V0SWQ7XG4gICAgICAgICAgICBzZWxmLnVwZGF0ZU1hcmtlcigpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYudXBkYXRlTWFya2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbWFya2VyID0ge1xuICAgICAgICAgICAgJ3N0cm9rZS13aWR0aCc6IDIsXG4gICAgICAgICAgICAnY2xhc3MnOiAoZGF0YU1vZGVsLmNvbG9yQ2xhc3MgPyBkYXRhTW9kZWwuY29sb3JDbGFzcyA6ICdkZWZhdWx0LWNvbG9yLWNsYXNzJyksXG4gICAgICAgICAgICBkOiAnTTAgMzIgTDggMzUgTDExIDMyIEwwOCAyOSBaJyAvLyBNMTAgMzQgTDAgMzIgTDEwIDMwIFogLy9NIDEwIDAgTCAwIDUgTCAxMCAxMCB6IC0gZmF0dGVyIGFycm93XG4gICAgICAgIH07XG4gICAgICAgIHZhciBhdHRycyA9IHtcbiAgICAgICAgICAgICcubWFya2VyLXRhcmdldCc6IChzZWxmLnRhcmdldFR5cGVJZCAhPT0gJ2Nyb3NzTm9kZScgJiYgIXNlbGYuaXNSZXZlcnNlRGlyZWN0aW9uID8gbWFya2VyIDogeyBkOiAnJyB9KSxcbiAgICAgICAgICAgICcubWFya2VyLXNvdXJjZSc6IChzZWxmLnNvdXJjZVR5cGVJZCAhPT0gJ2Nyb3NzTm9kZScgJiYgc2VsZi5pc1JldmVyc2VEaXJlY3Rpb24gPyBtYXJrZXIgOiB7IGQ6ICcnIH0pXG4gICAgICAgIH07XG4gICAgICAgIHNlbGYuYXR0cihhdHRycyk7XG4gICAgfVxuICAgIHNlbGYudXBkYXRlTWFya2VyKCk7XG59XG5FZGdlLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoam9pbnQuZGlhLkxpbmsucHJvdG90eXBlKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgTm9kZTogTm9kZSxcbiAgICBDcm9zc05vZGU6IENyb3NzTm9kZSxcbiAgICBFZGdlOiBFZGdlXG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBOb2RlID0gcmVxdWlyZSgnLi9ncmFwaEVsZW1lbnRzJykuTm9kZSxcbiAgICBDcm9zc05vZGUgPSByZXF1aXJlKCcuL2dyYXBoRWxlbWVudHMnKS5Dcm9zc05vZGUsXG4gICAgRWRnZSA9IHJlcXVpcmUoJy4vZ3JhcGhFbGVtZW50cycpLkVkZ2U7XG5cbnZhciBQYWdpbmF0aW9uID0gcmVxdWlyZSgnLi9wYWdpbmF0aW9uJyk7XG5cbnZhciBMYXlvdXRQYWdpbmF0aW9uTWFuYWdlciA9IHJlcXVpcmUoJy4vbGF5b3V0UGFnaW5hdGlvbk1hbmFnZXInKTtcbnZhciBMYXlvdXRQb3NpdGlvbk1hbmFnZXIgPSByZXF1aXJlKCcuL2xheW91dFBvc2l0aW9uTWFuYWdlcicpO1xuXG52YXIgQ29sb3JDb25maWd1cmF0b3IgPSByZXF1aXJlKCcuL2NvbG9yQ29uZmlndXJhdG9yJyk7XG5cbi8qKlxuICogTGF5b3V0IG9mIHRoZSBncmFwaC5cbiAqIENvbnRhaW4gYWxsIGdyYXBoIGVsZW1lbnRzLCBjb250cm9scyB0aGUgcGxhY2VtZW50IG9mIG5vZGVzLlxuICpcbiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnM6XG4gKiAgICAgIGdyYXBoOiBqb2ludC5kaWEuR3JhcGhcbiAqICAgICAgcGFwZXI6IGpvaW50LmRpYS5QYXBlclxuICogICAgICBzY3JvbGxlcjogam9pbnQudWkuUGFwZXJTY3JvbGxlclxuICogICAgICBfb3B0aW9uczoge1xuICogICAgICAgICAgREVGQVVMVF9QQUdFX1NJWkU6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19DT1VOVDogbnVtYmVyLCBcbiAqICAgICAgICAgIE1BWF9MQUJFTF9MRU5HVEg6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgUk9XX09GRlNFVDogbnVtYmVyLCBcbiAqICAgICAgICAgIENST1NTX05PREVfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ09MT1JfQ0xBU1NfTUFQOiB7XG4gKiAgICAgICAgICAgICAgJ3N1YkNsYXNzT2YnOiBzdHJpbmcsIFxuICogICAgICAgICAgICAgICd0eXBlJzogc3RyaW5nXG4gKiAgICAgICAgICB9XG4gKiAgICAgIH1cbiAqXG4gKiBQdWJsaWMgbWV0aG9kczpcbiAqICAgICAgY2xlYW5MYXlvdXQoKTogdm9pZFxuICogICAgICBzZXRSb290Tm9kZShyb290Tm9kZTogTm9kZSk6IHZvaWRcbiAqICAgICAgZ2V0Um9vdE5vZGUoKTogTm9kZVxuICogICAgICBnZXROb2RlcygpOiBOb2RlW11cbiAqICAgICAgZ2V0RWRnZXMoKTogRWRnZVtdXG4gKiAgICAgIHJlbW92ZUVkZ2UoZWRnZTogRWRnZSk6IHZvaWRcbiAqICAgICAgY29sbGFwc2VOb2RlKHVuYmluZEZyb21JZDogc3RyaW5nKTogdm9pZFxuICogICAgICByZW1vdmVOb2RlKG5vZGU6IE5vZGUsIHJlbW92ZUNoaWxkcmVuOiBib29sZWFuID0gZmFsc2UpOiB2b2lkXG4gKiAgICAgIHB1dEFsbChjZWxsczogKE5vZGV8RWRnZSksIGJpbmRUb0lkPzogc3RyaW5nKTogdm9pZCAtIChieSBkZWZhdWx0OiBiaW5kVG9JZCA9IF9yb290Tm9kZS5pZClcbiAqICAgICAgcHV0KGNlbGw6IChOb2RlfEVkZ2UpLCBiaW5kVG9JZD86IHN0cmluZyk6IHZvaWRcbiAqICAgICAgY2xvbmVOb2RlKG5vZGU6IE5vZGUpOiBOb2RlXG4gKiAgICAgIHJlY2FsY3VsYXRlTGF5b3V0KCk6IHZvaWRcbiAqICAgICAgZ2V0U2NhbGUoKToge3N4OiBudW1iZXIsIHN5OiBudW1iZXJ9XG4gKiAgICAgIGhpZGVOb2RlKG5vZGU6IE5vZGUpOiB2b2lkXG4gKiAgICAgIHNob3dOb2RlKG5vZGU6IE5vZGUpOiB2b2lkXG4gKiAgICAgIGRvRm9yQnJ1bmNoKG5vZGU6IE5vZGUsIGNhbGxCYWNrOiBmdW5jdGlvbik6IHZvaWRcbiAqL1xuZnVuY3Rpb24gR3JhcGhMYXlvdXQgKGdyYXBoLFxuICAgICAgICAgICAgICAgICAgICAgcGFwZXIsXG4gICAgICAgICAgICAgICAgICAgICBzY3JvbGxlcixcbiAgICAgICAgICAgICAgICAgICAgIF9vcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLyoqXG4gICAgICogUHJpdmF0ZSBmaWxkc1xuICAgICAqL1xuICAgIHZhciBfZ3JhcGggPSBudWxsO1xuICAgIHZhciBfcm9vdE5vZGUgPSBudWxsO1xuICAgIHZhciBfbm9kZXNCeUlkID0gbnVsbDtcbiAgICB2YXIgX25vZGVzQnlUeXBlID0gbnVsbDtcbiAgICB2YXIgX2VkZ2VzID0gbnVsbDtcbiAgICB2YXIgX3Njcm9sbGVyID0gbnVsbDtcbiAgICB2YXIgX3Bvc2l0aW9uTWFuYWdlciA9IG51bGw7XG4gICAgdmFyIF9wYWdpbmF0aW9uTWFuYWdlciA9IG51bGw7XG4gICAgdmFyIF9jb2xvckNvbmZpZ3VyYXRvciA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBQcml2YXRlIGZ1bmN0aW9uIHdoaWNoIHVzZWQgYXMgY29uc3RydWN0b3IuXG4gICAgICogQHBhcmFtICB7am9pbnQuZGlhLkdyYXBofSBncmFwaCAtIGpvaW50LmRpYS5HcmFwaFxuICAgICAqIEBwYXJhbSAge2pvaW50LmRpYS5QYXBlcn0gcGFwZXIgLSBqb2ludC5kaWEuUGFwZXJcbiAgICAgKiBAcGFyYW0gIHtqb2ludC51aS5QYXBlclNjcm9sbGVyfSBzY3JvbGxlciAtIGpvaW50LnVpLlBhcGVyU2Nyb2xsZXJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaW5pdGlhbGl6ZSAoZ3JhcGgsIHBhcGVyLCBzY3JvbGxlcikge1xuXG4gICAgICAgIF9ncmFwaCA9IGdyYXBoO1xuICAgICAgICBfc2Nyb2xsZXIgPSBzY3JvbGxlcjtcblxuICAgICAgICBfcG9zaXRpb25NYW5hZ2VyID0gbmV3IExheW91dFBvc2l0aW9uTWFuYWdlcihfb3B0aW9ucyk7XG4gICAgICAgIF9wYWdpbmF0aW9uTWFuYWdlciA9IG5ldyBMYXlvdXRQYWdpbmF0aW9uTWFuYWdlcihzZWxmLCBfb3B0aW9ucyk7XG5cbiAgICAgICAgX2NvbG9yQ29uZmlndXJhdG9yID0gbmV3IENvbG9yQ29uZmlndXJhdG9yKCk7XG5cbiAgICAgICAgc2VsZi5ibG9ja1ZhbGlkYXRpb24gPSBmYWxzZTtcbiAgICAgICAgc2VsZi5jbGVhbkxheW91dCgpO1xuICAgIH1cblxuICAgIHNlbGYubG9hZFN0YXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIGlmIChfcm9vdE5vZGUpIHNlbGYuY2xlYW5MYXlvdXQoKTtcbiAgICAgICAgXG4gICAgICAgIF9yb290Tm9kZSA9IHN0YXRlLnJvb3ROb2RlO1xuICAgICAgICBfZWRnZXMgPSBzdGF0ZS5lZGdlcztcbiAgICAgICAgX25vZGVzQnlJZCA9IHt9O1xuICAgICAgICBfbm9kZXNCeVR5cGUgPSB7fTtcbiAgICAgICAgc3RhdGUubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgaWYgKG5vZGUuZ2V0UHJldk5vZGUoKSkge1xuICAgICAgICAgICAgICAgIF9lbWJlZE5vZGUobm9kZSwgbm9kZS5nZXRQcmV2Tm9kZSgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub2RlLnBhZ2luYXRpb24pIHtcbiAgICAgICAgICAgICAgICBfZW1iZWROb2RlKG5vZGUucGFnaW5hdGlvbiwgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIV9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0pIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0gPSBbXTtcbiAgICAgICAgICAgIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0ucHVzaChub2RlKTtcbiAgICAgICAgICAgIF9ub2Rlc0J5SWRbbm9kZS5pZF0gPSBub2RlO1xuICAgICAgICB9KTtcbiAgICAgICAgX2dyYXBoLmFkZENlbGxzKHN0YXRlLnZpc2libGVFbGVtZW50cyk7XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByb290Tm9kZTogX3Jvb3ROb2RlLFxuICAgICAgICAgICAgZWRnZXM6IF9lZGdlcyxcbiAgICAgICAgICAgIG5vZGVzOiBzZWxmLmdldE5vZGVzKCksXG4gICAgICAgICAgICB2aXNpYmxlRWxlbWVudHM6IF9ncmFwaC5nZXRFbGVtZW50cygpXG4gICAgICAgICAgICAuY29uY2F0KF9ncmFwaC5nZXRMaW5rcygpKSxcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB2YWx1ZSBvZiBzY2FsZSBieSB4IGFuZCB5IGF4aXNcbiAgICAgKi9cbiAgICBzZWxmLmdldFNjYWxlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge3N4OiBfc2Nyb2xsZXIuX3N4LCBzeTogX3Njcm9sbGVyLl9zeX07XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIGlzIHVzZWQgZm9yIGNsZWFuIGxheW91dCBhbmQgcmVtb3ZlIGFsbCBub2RlcyBhbmQgZWRnZXMuXG4gICAgICovXG4gICAgc2VsZi5jbGVhbkxheW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3Jvb3ROb2RlID0gbnVsbDtcbiAgICAgICAgX25vZGVzQnlJZCA9IHt9O1xuICAgICAgICBfbm9kZXNCeVR5cGUgPSB7fTtcbiAgICAgICAgX2VkZ2VzID0gW107XG4gICAgICAgIF9ncmFwaC5jbGVhcigpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHJvb3Qgbm9kZSBmb3IgbGF5b3V0LlxuICAgICAqIElmIHdlIHRoZXJlIGlzIG9uZSwgdGhlbiB3ZSBjbGVhbiBsYXlvdXQuXG4gICAgICogQHBhcmFtIHtOb2RlfSByb290Tm9kZSAtIE5vZGUgd2hpY2ggd2lsbCBiZSB1c2VkIGFzIHJvb3RcbiAgICAgKi9cbiAgICBzZWxmLnNldFJvb3ROb2RlID0gZnVuY3Rpb24gKHJvb3ROb2RlKSB7XG4gICAgICAgIGlmIChfcm9vdE5vZGUpIHNlbGYuY2xlYW5MYXlvdXQoKTtcblxuICAgICAgICBfcm9vdE5vZGUgPSByb290Tm9kZTtcbiAgICAgICAgX3B1dE5vZGUocm9vdE5vZGUpO1xuICAgICAgICBfcm9vdE5vZGUuc2V0KCdleHBhbmRlZCcsIHRydWUpO1xuXG4gICAgICAgIF9sb2NhdGVOb2RlKF9yb290Tm9kZSwgcm9vdE5vZGUuaWQpO1xuICAgICAgICBzZWxmLnNob3dOb2RlKF9yb290Tm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgcm9vdCBub2RlIG9mIGxheW91dC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IE5vZGVzIG9mIHRoZSBsYXlvdXRcbiAgICAgKi9cbiAgICBzZWxmLmdldFJvb3ROb2RlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gX3Jvb3ROb2RlO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFsbCBub2RlcyBvZiB0aGUgbGF5b3V0LlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gRWRnZXMgb2YgdGhlIGxheW91dFxuICAgICAqL1xuICAgIHNlbGYuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhfbm9kZXNCeUlkKS5maWx0ZXIoZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gX25vZGVzQnlJZFtpZF07XG4gICAgICAgIH0pLm1hcChmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBfbm9kZXNCeUlkW2lkXTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYWxsIGVkZ2VzIG9mIHRoZSBsYXlvdXQuXG4gICAgICovXG4gICAgc2VsZi5nZXRFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF9lZGdlcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW1wbGVtZW50cyBvcHBvcnR1bml0eSB0byByZW1vdmUgZWRnZSBmcm9tIHRoZSBsYXlvdXRcbiAgICAgKiBAcGFyYW0ge0VkZ2V9IGVkZ2UgLSBFZGdlIHdoaWNoIG11c3QgYmUgcmVtb3ZlZFxuICAgICAqL1xuICAgIHNlbGYucmVtb3ZlRWRnZSA9IGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgICAgIF9lZGdlcy5zcGxpY2UoX2VkZ2VzLmluZGV4T2YoZWRnZSksIDEpO1xuICAgICAgICBlZGdlLmRpc2Nvbm5lY3QoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ29sbGFwc2VzIG5vZGUgYW5kIHJlbW92ZXMgYWxsIGNoaWxkcmVuXG4gICAgICogb2YgdGhlIE5vZGUgZnJvbSB0aGUgbGF5b3V0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVuYmluZEZyb21JZCAtIElkIG9mIHRoZSBub2RlIGZyb20gbGF5b3V0XG4gICAgICovXG4gICAgc2VsZi5jb2xsYXBzZU5vZGUgPSBmdW5jdGlvbiAodW5iaW5kRnJvbUlkKSB7XG4gICAgICAgIGlmIChfbm9kZXNCeUlkW3VuYmluZEZyb21JZF0pIHtcbiAgICAgICAgICAgIHZhciBub2RlID0gX25vZGVzQnlJZFt1bmJpbmRGcm9tSWRdO1xuICAgICAgICAgICAgaWYgKG5vZGUuaWQgPT09IF9yb290Tm9kZS5pZCkge1xuICAgICAgICAgICAgICAgIHNlbGYubGVmdFRyZWUgPSBbXTtcbiAgICAgICAgICAgICAgICBzZWxmLnJpZ2h0VHJlZSA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3BhZ2luYXRpb25NYW5hZ2VyLnJlbW92ZVBhZ2luYXRpb24obm9kZSk7XG4gICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSBub2RlLmdldENoaWxkcmVuKCk7XG4gICAgICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChjaCkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVtb3ZlTm9kZShjaCwgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIG5vZGUgZnJvbSB0aGUgbGF5b3V0IGFuZCAoaWYgbmVlZGVkKSByZW1vdmVzIGFsbCBoaXMgY2hpbGRyZW5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbm9kZSAtIElkIG9mIHRoZSBub2RlIGZyb20gbGF5b3V0XG4gICAgICogQHBhcmFtIHtib29sZWFufSByZW1vdmVDaGlsZHJlbiAtIElmIHRydWUgdGhlbiBjaGlsZHJlbiB3aWxsIGJlIHJlbW92ZWRcbiAgICAgKi9cbiAgICBzZWxmLnJlbW92ZU5vZGUgPSBmdW5jdGlvbiAobm9kZSwgcmVtb3ZlQ2hpbGRyZW4pIHtcbiAgICAgICAgX3BhZ2luYXRpb25NYW5hZ2VyLnJlbW92ZVBhZ2luYXRpb24obm9kZSk7XG5cbiAgICAgICAgaWYgKG5vZGUucGFyZW50RWRnZSkgc2VsZi5yZW1vdmVFZGdlKG5vZGUucGFyZW50RWRnZSk7XG4gICAgICAgIG5vZGUuc2V0KCdoYXNQb3NpdGlvbicsIGZhbHNlKTtcblxuICAgICAgICBpZiAocmVtb3ZlQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IG5vZGUuZ2V0Q2hpbGRyZW4oKTtcbiAgICAgICAgICAgIGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZW1vdmVOb2RlKGNoLCB0cnVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAoX25vZGVzQnlJZFtub2RlLmlkXSkgX25vZGVzQnlJZFtub2RlLmlkXSA9IG51bGw7XG4gICAgICAgIGlmIChfbm9kZXNCeVR5cGVbbm9kZS50eXBlSWRdICYmIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0ubGVuZ3RoID4gMClcbiAgICAgICAgICAgIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0uc3BsaWNlKF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0uaW5kZXhPZihub2RlKSwgMSk7XG5cbiAgICAgICAgaWYgKCFub2RlLmdldCgnaGlkZGVuJykpIHNlbGYuaGlkZU5vZGUobm9kZSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYWxsIG5vZGVzIG9yIGVkZ2VzIG9uIHRoZSBsYXlvdXRcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjZWxscyAtIEFycmF5IG9mIGNlbGxzIChFZGdlfE5vZGUpXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGJpbmRUb0lkIC0gU291cmNlIG5vZGVcbiAgICAgKiB3aGljaCB3aWxsIGJlIGFkZGVkIG9uIHRoZSBsYXlvdXRcbiAgICAgKi9cbiAgICBzZWxmLnB1dEFsbCA9IGZ1bmN0aW9uIChjZWxscywgYmluZFRvSWQpIHtcbiAgICAgICAgY2VsbHMuZm9yRWFjaChmdW5jdGlvbiAoY2VsbCkge1xuICAgICAgICAgICAgc2VsZi5wdXQoY2VsbCwgYmluZFRvSWQpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQWRkcyBvbmUgbm9kZSBvciBlZGdlIG9uIHRoZSBsYXlvdXRcbiAgICAgKiBAcGFyYW0ge05vZGV8RWRnZX0gY2VsbCAtIENlbGwgd2hpY2hcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYmluZFRvSWQgLSBTb3VyY2Ugbm9kZVxuICAgICAqIHdpbGwgYmUgYWRkZWQgb24gdGhlIGxheW91dFxuICAgICAqL1xuICAgIHNlbGYucHV0ID0gZnVuY3Rpb24gKGNlbGwsIGJpbmRUb0lkKSB7XG4gICAgICAgIGlmIChjZWxsIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICAgICAgX3B1dE5vZGUoY2VsbCk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2VsbCBpbnN0YW5jZW9mIEVkZ2UpIHtcbiAgICAgICAgICAgIF9wdXRFZGdlKGNlbGwsIGJpbmRUb0lkKTtcbiAgICAgICAgfSBlbHNlIGlmIChjZWxsIGluc3RhbmNlb2YgUGFnaW5hdGlvbikge1xuICAgICAgICAgICAgX3B1dFBhZ2luYXRpb24oY2VsbCwgYmluZFRvSWQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlbG9jYXRlcyBhbGwgbm9kZXMgb2YgbGF5b3V0IG9uIHRoZWlyIHBvc2l0aW9uXG4gICAgICovXG4gICAgc2VsZi5yZWNhbGN1bGF0ZUxheW91dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFfcm9vdE5vZGUpIHJldHVybjtcblxuICAgICAgICBzZWxmLmJsb2NrVmFsaWRhdGlvbiA9IHRydWU7XG5cbiAgICAgICAgdmFyIHggPSBfcm9vdE5vZGUucG9zaXRpb24oKS54O1xuICAgICAgICB2YXIgeSA9IF9yb290Tm9kZS5wb3NpdGlvbigpLnk7XG5cbiAgICAgICAgaWYgKCFfcm9vdE5vZGUuZ2V0KCdjdXN0b21Qb3NpdGlvbicpKSB7XG4gICAgICAgICAgICB2YXIgcGggPSBfc2Nyb2xsZXIub3B0aW9ucy5iYXNlSGVpZ2h0O1xuICAgICAgICAgICAgdmFyIHB3ID0gX3Njcm9sbGVyLm9wdGlvbnMuYmFzZVdpZHRoO1xuICAgICAgICAgICAgeCA9IChwdyAtIF9yb290Tm9kZS5nZXRTaXplKCkud2lkdGgpIC8gMjtcbiAgICAgICAgICAgIHkgPSAocGggLSBfcm9vdE5vZGUuZ2V0U2l6ZSgpLmhlaWdodCkgLyAyO1xuXG4gICAgICAgICAgICB2YXIgZHggPSB4IC0gX3Jvb3ROb2RlLnBvc2l0aW9uKCkueDtcbiAgICAgICAgICAgIHZhciBkeSA9IHkgLSBfcm9vdE5vZGUucG9zaXRpb24oKS55O1xuICAgICAgICAgICAgX3Jvb3ROb2RlLnRyYW5zbGF0ZShkeCwgZHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgX3BhZ2luYXRpb25NYW5hZ2VyLnBhZ2luYXRlTm9kZShfcm9vdE5vZGUpO1xuXG4gICAgICAgIF9wb3NpdGlvbk1hbmFnZXIuY2FsY3VsYXRlTGF5b3V0Rm9yTm9kZShfcm9vdE5vZGUpO1xuXG4gICAgICAgIF9wYWdpbmF0aW9uTWFuYWdlci5zZXRQYWdpbmF0aW9uUG9zaXRpb24oX3Jvb3ROb2RlKTtcbiAgICAgICAgXG4gICAgICAgIHNlbGYuYmxvY2tWYWxpZGF0aW9uID0gZmFsc2U7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEltcGxlbWVudHMgb3Bwb3J0dW5pdHkgdG8gY3JlYXRlIGNvcHkgb2YgYW55IE5vZGVcbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGUgLSBUaGUgY29waWVkIG5vZGVcbiAgICAgKi9cbiAgICBzZWxmLmNsb25lTm9kZSA9IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIHJldHVybiBuZXcgTm9kZSh7XG4gICAgICAgICAgICB0eXBlSWQ6IG5vZGUuZGF0YU1vZGVsLnR5cGVJZCxcbiAgICAgICAgICAgIGxhYmVsOiBub2RlLmRhdGFNb2RlbC5sYWJlbCxcbiAgICAgICAgICAgIGNvbG9yQ2xhc3M6IG5vZGUuZGF0YU1vZGVsLmNvbG9yQ2xhc3MsXG4gICAgICAgICAgICBjYW5FeHBhbmQ6IG5vZGUuZGF0YU1vZGVsLmNhbkV4cGFuZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSGlkZXMgb25lIG5vZGUgLSByZW1vdmVzIG9ubHkgZnJvbSBncmFwaCwgbm90IGZyb20gbGF5b3V0LlxuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZSAtIE5vZGUgd2hpY2ggd2lsbCBiZSBoaWRkZW5cbiAgICAgKi9cbiAgICBzZWxmLmhpZGVOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgaWYgKCFub2RlLmdldCgnaGlkZGVuJykpIHtcbiAgICAgICAgICAgIG5vZGUucmVtb3ZlKCk7XG5cbiAgICAgICAgICAgIHZhciBwcmV2ID0gbm9kZS5nZXRQcmV2Tm9kZSgpO1xuICAgICAgICAgICAgaWYgKHByZXYpIF91bmVtYmVkTm9kZShub2RlLCBwcmV2KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgbm9kZS5zZXQoJ2hpZGRlbicsIHRydWUpO1xuICAgICAgICAgICAgX3BhZ2luYXRpb25NYW5hZ2VyLmhpZGVQYWdpbmF0aW9uKG5vZGUpO1xuICAgICAgICAgICAgbm9kZS5nZXRDaGlsZHJlbigpLmZvckVhY2goZnVuY3Rpb24gKGNoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5oaWRlTm9kZShjaCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTaG93cyBvbmUgbm9kZSAtIHB1dHMgbm9kZSBvbiB0aGUgZ3JhcGguXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlIC0gTm9kZSB3aGljaCB3aWxsIGJlIHNob3dlZFxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gd2l0aG91dENoaWxkcmVuIC0gaWYgdHJ1ZSBjaGlsZHJlbiBhcmVuJ3QgY291bnRlZFxuICAgICAqL1xuICAgIHNlbGYuc2hvd05vZGUgPSBmdW5jdGlvbiAobm9kZSwgd2l0aG91dENoaWxkcmVuKSB7XG4gICAgICAgIGlmIChub2RlLmdldCgnaGlkZGVuJykpIHtcbiAgICAgICAgICAgIF9ncmFwaC5hZGRDZWxsKG5vZGUpO1xuICAgICAgICAgICAgaWYgKG5vZGUucGFyZW50RWRnZSkge1xuICAgICAgICAgICAgICAgIHNlbGYuc2hvd05vZGUobm9kZS5nZXRQcmV2Tm9kZSgpKTtcbiAgICAgICAgICAgICAgICBfZ3JhcGguYWRkQ2VsbChub2RlLnBhcmVudEVkZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbm9kZS5zZXQoJ2hpZGRlbicsIGZhbHNlKTtcblxuICAgICAgICAgICAgdmFyIHByZXYgPSBub2RlLmdldFByZXZOb2RlKCk7XG4gICAgICAgICAgICBpZiAocHJldikgX2VtYmVkTm9kZShub2RlLCBwcmV2KTtcblxuICAgICAgICAgICAgX3BhZ2luYXRpb25NYW5hZ2VyLnNob3dQYWdpbmF0aW9uKG5vZGUpO1xuICAgICAgICAgICAgaWYgKCF3aXRob3V0Q2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBub2RlLmdldENoaWxkcmVuKCkuZm9yRWFjaChmdW5jdGlvbiAoY2gpIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zaG93Tm9kZShjaCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUGVyZm9ybXMgYWN0aW9uIGZvciBicmFuY2hcbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGUgLSByb290IG5vZGUgb2YgdGhlIGJyYW5jaFxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxCYWNrIC0gcGVyZm9ybWVkIGFjdGlvblxuICAgICAqL1xuICAgIHNlbGYuZG9Gb3JCcnVuY2ggPSBmdW5jdGlvbiAobm9kZSwgY2FsbEJhY2spIHtcbiAgICAgICAgbm9kZS5nZXRDaGlsZHJlbigpLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgICAgICBzZWxmLmRvRm9yQnJ1bmNoKGNoaWxkLCBjYWxsQmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgICBjYWxsQmFjayhub2RlKTtcbiAgICB9O1xuXG4gICAgLy9Qcml2YXRlIGZ1bmN0aW9uc1xuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYW5kIGVtYmVkcyBwYWdpbmF0aW9uIHRvIG5vZGVcbiAgICAgKiBAcGFyYW0ge1BhZ2luYXRpb259IHBhZ2luYXRpb24gLSBQYWdpbmF0aW9uIGZvciBub2RlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5vZGVJZCAtIGVkZ2VzIG9mIHRoaXMgbm9kZSB3aWxsIGJlIHBvZ2luYXRlZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9wdXRQYWdpbmF0aW9uIChwYWdpbmF0aW9uLCBub2RlSWQpIHtcbiAgICAgICAgaWYgKF9ub2Rlc0J5SWRbbm9kZUlkXSAmJiAhX25vZGVzQnlJZFtub2RlSWRdLmdldCgnaGlkZGVuJykpIHtcbiAgICAgICAgICAgIF9ncmFwaC5hZGRDZWxsKHBhZ2luYXRpb24pO1xuICAgICAgICAgICAgX25vZGVzQnlJZFtub2RlSWRdLmVtYmVkKHBhZ2luYXRpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWRkcyBub2RlIHRvIHRoZSBub2RlIGxpc3QgKG5vdCBvbiBsYXlvdXQpXG4gICAgICogTm90IGRvZXMgaXQgaWYgZWRnZSBhbHJlYWR5IGV4aXN0c1xuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZSAtIE5ldyBub2RlXG4gICAgICogQHBhcmFtIHtib29sZWFufSBpZ25vclJlcGVhdGVkIC0gSWdub3JlIHJlcGVhdGluZ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9wdXROb2RlIChub2RlLCBpZ25vclJlcGVhdGVkKSB7XG4gICAgICAgIGlmICghX25vZGVzQnlUeXBlW25vZGUudHlwZUlkXSB8fCBfbm9kZXNCeVR5cGVbbm9kZS50eXBlSWRdLmxlbmd0aCA9PT0gMCB8fCBpZ25vclJlcGVhdGVkKSB7XG4gICAgICAgICAgICBpZiAoIV9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0pIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0gPSBbXTtcblxuICAgICAgICAgICAgaWYgKF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0uaW5kZXhPZihub2RlKSA9PT0gLTEpIF9ub2Rlc0J5VHlwZVtub2RlLnR5cGVJZF0ucHVzaChub2RlKTtcbiAgICAgICAgICAgIF9ub2Rlc0J5SWRbbm9kZS5pZF0gPSBub2RlO1xuICAgICAgICAgICAgbm9kZS5zZXRMYXlvdXQoc2VsZik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGVkZ2UgdG8gdGhlIGVkZ2UgbGlzdCwgdGhlblxuICAgICAqIGFkZCBzb3VyY2UgYW5kIHRhcmdldCBhbmQgc291cmNlIG5vZGVcbiAgICAgKiBvbiB0aGUgbGF5b3V0IChpZiB0aGV5IGFyZW4ndCB5ZXQpIGFuZFxuICAgICAqIG5leHQgYWRkcyBlZGdlIG9uIHRoZSBsYXlvdXQuXG4gICAgICogTm90IGRvZXMgaXQgaWYgZWRnZSBhbHJlYWR5IGV4aXN0c1xuICAgICAqIEBwYXJhbSB7RWRnZX0gZWRnZSAtIE5ldyBlZGdlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGJpbmRUb0lkIC0gSWQgb2YgdGhlIHNvdXJjZSBub2RlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3B1dEVkZ2UgKGVkZ2UsIGJpbmRUb0lkKSB7XG4gICAgICAgIGlmICghYmluZFRvSWQgfHwgIV9ub2Rlc0J5SWRbYmluZFRvSWRdKSBiaW5kVG9JZCA9IF9yb290Tm9kZS5pZDtcblxuICAgICAgICBpZiAoX25vZGVzQnlUeXBlW2VkZ2Uuc291cmNlVHlwZUlkXSAmJlxuICAgICAgICAgICAgX25vZGVzQnlUeXBlW2VkZ2UudGFyZ2V0VHlwZUlkXSAmJlxuICAgICAgICAgICAgZWRnZS50YXJnZXRUeXBlSWQgPT09IF9ub2Rlc0J5SWRbYmluZFRvSWRdLnR5cGVJZCkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBlZGdlLnJldmVyc2VFZGdlRGlyZWN0aW9uKHRydWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHBvcnQgPSBfZ2V0U291cmNlUG9ydChlZGdlLCBfbm9kZXNCeUlkW2JpbmRUb0lkXSk7XG4gICAgICAgIGlmIChwb3J0ID09PSBfbm9kZXNCeUlkW2JpbmRUb0lkXSkge1xuICAgICAgICAgICAgdmFyIGNvbXBsZXRlRWRnZSA9IF9lbnJpY2hFZGdlKGVkZ2UsIGJpbmRUb0lkKTtcblxuICAgICAgICAgICAgaWYgKGNvbXBsZXRlRWRnZSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKCFjb21wbGV0ZUVkZ2UudGFyZ2V0LmdldCgnaGFzUG9zaXRpb24nKSkge1xuICAgICAgICAgICAgICAgICAgICBfcHV0Tm9kZShjb21wbGV0ZUVkZ2UudGFyZ2V0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgX2xvY2F0ZU5vZGUoY29tcGxldGVFZGdlLnRhcmdldCwgYmluZFRvSWQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghY29tcGxldGVFZGdlLnNvdXJjZS5nZXQoJ2hhc1Bvc2l0aW9uJykpIHtcbiAgICAgICAgICAgICAgICAgICAgX3B1dE5vZGUoY29tcGxldGVFZGdlLnNvdXJjZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIF9sb2NhdGVOb2RlKGNvbXBsZXRlRWRnZS5zb3VyY2UsIGJpbmRUb0lkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2VkZ2VzLnB1c2goY29tcGxldGVFZGdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF9wdXRFZGdlKGVkZ2UsIHBvcnQuaWQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSXQgQ2hlY2tzIHRoZXJlIGlzIHNhbWUgZWRnZSBpbiB0aGUgbGF5b3V0XG4gICAgICogQHBhcmFtIHtFZGdlfSBuZXdFZGdlIC0gTmV3IGVkZ2VcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYmluZFRvSWQgLSBJZCBvZiB0aGUgc291cmNlIG5vZGVcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaXNFZGdlRXhpc3RzIChuZXdFZGdlLCBiaW5kVG9JZCkge1xuICAgICAgICByZXR1cm4gX2VkZ2VzLmZpbHRlcihmdW5jdGlvbiAoZWRnZSkge1xuICAgICAgICAgICAgaWYgKG5ld0VkZ2UuaXNSZXZlcnNlRGlyZWN0aW9uID09PSBlZGdlLmlzUmV2ZXJzZURpcmVjdGlvbiB8fCBuZXdFZGdlLmlzUmV2ZXJzZURpcmVjdGlvbiAmJiBlZGdlLmlzUmV2ZXJzZURpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiAoIGVkZ2UudHlwZUlkID09PSBuZXdFZGdlLnR5cGVJZCAmJlxuICAgICAgICAgICAgICAgICAgICBlZGdlLnNvdXJjZVR5cGVJZCA9PT0gbmV3RWRnZS5zb3VyY2VUeXBlSWQpICYmXG4gICAgICAgICAgICAgICAgICAgIGVkZ2UudGFyZ2V0VHlwZUlkID09PSBuZXdFZGdlLnRhcmdldFR5cGVJZCAmJlxuICAgICAgICAgICAgICAgICAgICAoXG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnNvdXJjZS5pZCA9PT0gYmluZFRvSWQgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVkZ2UudGFyZ2V0LmlkID09PSBiaW5kVG9JZFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKCBlZGdlLnR5cGVJZCA9PT0gbmV3RWRnZS50eXBlSWQgJiZcbiAgICAgICAgICAgICAgICAgICAgZWRnZS5zb3VyY2VUeXBlSWQgPT09IG5ld0VkZ2UudGFyZ2V0VHlwZUlkKSAmJlxuICAgICAgICAgICAgICAgICAgICBlZGdlLnRhcmdldFR5cGVJZCA9PT0gbmV3RWRnZS5zb3VyY2VUeXBlSWQgJiZcbiAgICAgICAgICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAgICAgICAgICAgZWRnZS5zb3VyY2UuaWQgPT09IGJpbmRUb0lkIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBlZGdlLnRhcmdldC5pZCA9PT0gYmluZFRvSWRcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgc291cmNlIGFuZCB0YXJnZXQgdHlwZSBpZHMsIGFuZCBiYXNpbmcgb24gaXQsXG4gICAgICogcHV0cyBjb25jcmV0ZSBzb3VyY2UgYW5kIHRhcmdldCBvYmplY3RzIGludG8gZWRnZVxuICAgICAqIEBwYXJhbSB7RWRnZX0gZWRnZSAtIEVkZ2VcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gYmluZFRvSWQgLSBJZCBvZiB0aGUgc291cmNlIG5vZGVcbiAgICAgKiBAcmV0dXJucyB7RWRnZX0gRW5yaWNoZWQgZWRnZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9lbnJpY2hFZGdlIChlZGdlLCBiaW5kVG9JZCkge1xuICAgICAgICBpZiAoX2lzRWRnZUV4aXN0cyhlZGdlLCBiaW5kVG9JZCkpIHJldHVybiBudWxsO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFiaW5kVG9JZCkgYmluZFRvSWQgPSBfcm9vdE5vZGUuaWQ7XG5cbiAgICAgICAgaWYgKF9ub2Rlc0J5VHlwZVtlZGdlLnNvdXJjZVR5cGVJZF0gJiZcbiAgICAgICAgICAgIF9ub2Rlc0J5VHlwZVtlZGdlLnRhcmdldFR5cGVJZF0gJiZcbiAgICAgICAgICAgIGVkZ2Uuc291cmNlVHlwZUlkID09PSBfbm9kZXNCeUlkW2JpbmRUb0lkXS50eXBlSWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gX25vZGVzQnlJZFtiaW5kVG9JZF07XG4gICAgICAgICAgICB2YXIgdGFyZ2V0ID0gX2dldEZyZWVOb2RlQnlUeXBlKGVkZ2UudGFyZ2V0VHlwZUlkKTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0ICYmIF9ub2Rlc0J5VHlwZVtlZGdlLnRhcmdldFR5cGVJZF1bMF0pIHtcbiAgICAgICAgICAgICAgICB0YXJnZXQgPSBzZWxmLmNsb25lTm9kZShfbm9kZXNCeVR5cGVbZWRnZS50YXJnZXRUeXBlSWRdWzBdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZWRnZS5zZXRTb3VyY2Uoc291cmNlLCB0cnVlKTtcbiAgICAgICAgICAgIGVkZ2Uuc2V0VGFyZ2V0KHRhcmdldCwgZmFsc2UpO1xuXG4gICAgICAgICAgICBlZGdlLnNldENvbG9yQ2xhc3MoX2NvbG9yQ29uZmlndXJhdG9yLmdldENvbG9yQ2xhc3NGb3JFbGVtZW50KGVkZ2UuZGF0YU1vZGVsLmxhYmVsKSk7XG4gICAgICAgICAgICB0YXJnZXQuc2V0Q29sb3JDbGFzcyhlZGdlLmRhdGFNb2RlbC5jb2xvckNsYXNzKTtcbiAgICAgICAgICAgIHJldHVybiBlZGdlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgKHRhcmdldC9zb3VyY2UpIG5vZGUgYXMgYSBwb3J0LCBvciwgaWYgdGhlcmUgYXJlIGVkZ2VzIFxuICAgICAqIHdpdGggc2FtZSB0eXBlLCBpdCB3aWxsIHJldHVybiBjcm9zc05vZGVcbiAgICAgKiBAcGFyYW0ge0VkZ2V9IGVkZ2UgLSBFZGdlXG4gICAgICogQHBhcmFtIHtOb2RlfSByb290Tm9kZSAtICh0YXJnZXQvc291cmNlKSBub2RlLCB3aGljaCBpcyBmb3IgY29udGVjdGluZyBieSBlZGdlXG4gICAgICogQHJldHVybnMge05vZGV9ICh0YXJnZXQvc291cmNlIG9yIGNyb3NzTm9kZSlcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0U291cmNlUG9ydCAoZWRnZSwgcm9vdE5vZGUpIHtcbiAgICAgICAgaWYgKHJvb3ROb2RlLnR5cGVJZCA9PT0gJ2Nyb3NzTm9kZScpIHtcbiAgICAgICAgICAgIGVkZ2Uuc2V0KCdsYWJlbHMnLCBbXSk7XG4gICAgICAgICAgICBlZGdlLnNvdXJjZVR5cGVJZCA9ICdjcm9zc05vZGUnO1xuICAgICAgICAgICAgZWRnZS51cGRhdGVNYXJrZXIoKTtcbiAgICAgICAgICAgIHJldHVybiByb290Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBleGlzdGVkRWRnZSA9IHJvb3ROb2RlLmdldEVkZ2VCeVR5cGUoZWRnZS50eXBlSWQsIGVkZ2UuaXNSZXZlcnNlRGlyZWN0aW9uLCBlZGdlLmdldE9yaWVudGF0aW9uKCkpO1xuXG4gICAgICAgIGlmICghZXhpc3RlZEVkZ2UpIHtcbiAgICAgICAgICAgIHJldHVybiByb290Tm9kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBjcm9zc05vZGU7XG4gICAgICAgICAgICBpZiAoZXhpc3RlZEVkZ2UudGFyZ2V0VHlwZUlkICE9PSAnY3Jvc3NOb2RlJyAmJiBleGlzdGVkRWRnZS5zb3VyY2VUeXBlSWQgIT09ICdjcm9zc05vZGUnKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9IGV4aXN0ZWRFZGdlLnRhcmdldDtcbiAgICAgICAgICAgICAgICB2YXIgc291cmNlID0gZXhpc3RlZEVkZ2Uuc291cmNlO1xuICAgICAgICAgICAgICAgIHNlbGYucmVtb3ZlRWRnZShleGlzdGVkRWRnZSk7XG5cbiAgICAgICAgICAgICAgICBjcm9zc05vZGUgPSBuZXcgQ3Jvc3NOb2RlKGV4aXN0ZWRFZGdlLmRhdGFNb2RlbC5jb2xvckNsYXNzKTtcbiAgICAgICAgICAgICAgICBfcHV0Tm9kZShjcm9zc05vZGUsIHRydWUpO1xuXG4gICAgICAgICAgICAgICAgdmFyIHR5cGVFZGdlID0gbmV3IEVkZ2Uoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlSWQ6IGV4aXN0ZWRFZGdlLmRhdGFNb2RlbC50eXBlSWQsXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZVR5cGVJZDogZXhpc3RlZEVkZ2Uuc291cmNlVHlwZUlkLFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRUeXBlSWQ6ICdjcm9zc05vZGUnLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogZXhpc3RlZEVkZ2UuZGF0YU1vZGVsLmxhYmVsLFxuICAgICAgICAgICAgICAgICAgICBjb2xvckNsYXNzOiBleGlzdGVkRWRnZS5kYXRhTW9kZWwuY29sb3JDbGFzcyxcbiAgICAgICAgICAgICAgICAgICAgcGxhY2VtZW50OiBleGlzdGVkRWRnZS5wbGFjZW1lbnQsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0eXBlRWRnZS5pc1JldmVyc2VEaXJlY3Rpb24gPSBlZGdlLmlzUmV2ZXJzZURpcmVjdGlvbjtcbiAgICAgICAgICAgICAgICB0eXBlRWRnZS51cGRhdGVNYXJrZXIoKTtcbiAgICAgICAgICAgICAgICB0eXBlRWRnZS5zZXRTb3VyY2Uoc291cmNlLCB0cnVlLCAnbGVmdCcpO1xuICAgICAgICAgICAgICAgIHR5cGVFZGdlLnNldFRhcmdldChjcm9zc05vZGUsIGZhbHNlLCAncmlnaHQnKTtcbiAgICAgICAgICAgICAgICBfZWRnZXMucHVzaCh0eXBlRWRnZSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgX2xvY2F0ZU5vZGUoY3Jvc3NOb2RlLCByb290Tm9kZS5pZCk7XG5cbiAgICAgICAgICAgICAgICB2YXIgc2Vjb25kUGFydCA9IG5ldyBFZGdlKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZUlkOiBleGlzdGVkRWRnZS5kYXRhTW9kZWwudHlwZUlkLFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VUeXBlSWQ6ICdjcm9zc05vZGUnLFxuICAgICAgICAgICAgICAgICAgICB0YXJnZXRUeXBlSWQ6IGV4aXN0ZWRFZGdlLnRhcmdldFR5cGVJZCxcbiAgICAgICAgICAgICAgICAgICAgbGFiZWw6ICcnLFxuICAgICAgICAgICAgICAgICAgICBjb2xvckNsYXNzOiBleGlzdGVkRWRnZS5kYXRhTW9kZWwuY29sb3JDbGFzcyxcbiAgICAgICAgICAgICAgICAgICAgcGxhY2VtZW50OiBleGlzdGVkRWRnZS5wbGFjZW1lbnQsXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBzZWNvbmRQYXJ0LmlzUmV2ZXJzZURpcmVjdGlvbiA9IGVkZ2UuaXNSZXZlcnNlRGlyZWN0aW9uO1xuICAgICAgICAgICAgICAgIHNlY29uZFBhcnQudXBkYXRlTWFya2VyKCk7XG4gICAgICAgICAgICAgICAgc2Vjb25kUGFydC5zZXRTb3VyY2UoY3Jvc3NOb2RlLCB0cnVlLCAnbGVmdCcpO1xuICAgICAgICAgICAgICAgIHNlY29uZFBhcnQuc2V0VGFyZ2V0KHRhcmdldCwgZmFsc2UsICdyaWdodCcpO1xuICAgICAgICAgICAgICAgIF9lZGdlcy5wdXNoKHNlY29uZFBhcnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjcm9zc05vZGUgPSBleGlzdGVkRWRnZS50YXJnZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjcm9zc05vZGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgbm9kZSBmcm9tIHRoZSBub2RlIGxpc3QuXG4gICAgICogSWYgbm9kZSBpcyBwcmVzZW50IG9uIGRpYWdyYW0sIHJldHVybnMgY29weS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZUlkIC0gSWQgb2YgdGhlIHNvdXJjZSBub2RlXG4gICAgICogQHJldHVybnMge05vZGV9IEZyZWUgbm9kZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRGcmVlTm9kZUJ5VHlwZSAodHlwZUlkKSB7XG4gICAgICAgIHZhciBub2RlcyA9IF9ub2Rlc0J5VHlwZVt0eXBlSWRdO1xuICAgICAgICBpZiAoIW5vZGVzIHx8IG5vZGVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgaWYgKCFub2Rlc1tpXS5nZXQoJ2hhc1Bvc2l0aW9uJykpIHJldHVybiBub2Rlc1tpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQdXRzIG5vZGUgaW50byBsYXlvdXQuXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlIC0gTm9kZSB3aGljaCB3aWxsIGJlIHBvc3RlZFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBiaW5kVG9JZCAtIFNvdXJjZSBub2RlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2xvY2F0ZU5vZGUgKG5vZGUpIHtcbiAgICAgICAgaWYgKCFfcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHNlbGYuc2V0Um9vdE5vZGUobm9kZSk7XG4gICAgICAgIH1cblxuICAgICAgICBub2RlLnNldCgnaGFzUG9zaXRpb24nLCB0cnVlKTtcbiAgICAgICAgbm9kZS5yZWluaXQoKTtcbiAgICAgICAgLy8gc2VsZi5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVtYmVkIGEgbm9kZSBpbnRvIHBhcmVudCBub2RlXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlIC0gTm9kZSBvZiB0aGUgYnJhbmNoXG4gICAgICogQHBhcmFtIHtOb2RlfSBwYXJlbnQgLSBQYXJlbnQgbm9kZVxuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gX2VtYmVkTm9kZSAobm9kZSwgcGFyZW50KSB7XG4gICAgICAgIGlmICghbm9kZS5pc0VtYmVkZGVkSW4ocGFyZW50KSkgcGFyZW50LmVtYmVkKG5vZGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWUgdXAgYW4gZW1iZWRkZWQgbm9kZSBmcm9tIHBhcmVudCBub2RlXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlIC0gTm9kZSBvZiB0aGUgYnJhbmNoXG4gICAgICogQHBhcmFtIHtOb2RlfSBwYXJlbnQgLSBQYXJlbnQgbm9kZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF91bmVtYmVkTm9kZSAobm9kZSwgcGFyZW50KSB7XG4gICAgICAgIGlmIChub2RlLmlzRW1iZWRkZWRJbihwYXJlbnQpKSBwYXJlbnQudW5lbWJlZChub2RlKTtcbiAgICB9XG5cbiAgICAvL0hlcmUgd2UgY2FsbCBjb25zdHJ1Y3RvciBhZnRlciBkZWZpbmluZyBhbGwgZnVuY3Rpb25zXG4gICAgX2luaXRpYWxpemUuY2FsbChzZWxmLCBncmFwaCwgcGFwZXIsIHNjcm9sbGVyKTtcbn1cbm1vZHVsZS5leHBvcnRzID0gR3JhcGhMYXlvdXQ7XG5cbiIsInZhciBUUUdyYW1VSSA9IHJlcXVpcmUoJ3Zpc3VhbGl6YXRpb25zLWxpYnJhcnknKTtcbnZhciBJbmZvUGFuZWwgPSByZXF1aXJlKCcuL2luZm9QYW5lbCcpO1xudmFyIE9wdGlvbnNQYW5lbCA9IHJlcXVpcmUoJy4vb3B0aW9uc1BhbmVsJyk7XG5cbmZ1bmN0aW9uIERlZmF1bHRVSSAob3B0aW9ucykge1xuICAgIC8vIEluaXRpYWxpemF0aW9uXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHZhciBfbmVpZ2hib3JHcmFtID0gb3B0aW9ucy5saW5lYWdlR3JhbTtcbiAgICB2YXIgbWFya3VwID0gJzxkaXYgY2xhc3M9XCJ0cS1uZy1kZWZhdWx0LXVzZXItdWlcIj4nICtcbiAgICAgICAgJzxkaXYgaWQ9XCJ0cUxnVG9vbGJhclwiPjwvZGl2PicgK1xuICAgICAgICAnPGRpdiBpZD1cInRxTGdJbmZvUGFuZWxcIj48L2Rpdj4nICtcbiAgICAgICAgJzxkaXYgaWQ9XCJ0cUxnT3B0aW9uc1BhbmVsXCI+PC9kaXY+JyArXG4gICAgICAgICc8ZGl2IGlkPVwidHFMZ1NlYXJjaFBhbmVsXCI+PC9kaXY+JyArXG4gICAgJzwvZGl2Pic7XG5cbiAgICB2YXIgX2VsO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy5iYXNlRWxlbWVudCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQob3B0aW9ucy5iYXNlRWxlbWVudCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucy5iYXNlRWxlbWVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgX2VsID0gb3B0aW9ucy5iYXNlRWxlbWVudDtcbiAgICB9XG4gICAgaWYgKCFfZWwpIHJldHVybjtcbiAgICBfZWwuaW5uZXJIVE1MID0gbWFya3VwO1xuXG4gICAgdmFyIHRxTGdUb29sYmFyID0gX2VsLnF1ZXJ5U2VsZWN0b3IoJyN0cUxnVG9vbGJhcicpO1xuICAgIHZhciB0cUxnSW5mb1BhbmVsID0gX2VsLnF1ZXJ5U2VsZWN0b3IoJyN0cUxnSW5mb1BhbmVsJyk7XG4gICAgdmFyIHRxTGdPcHRpb25zUGFuZWwgPSBfZWwucXVlcnlTZWxlY3RvcignI3RxTGdPcHRpb25zUGFuZWwnKTtcbiAgICB2YXIgdHFMZ1NlYXJjaFBhbmVsID0gX2VsLnF1ZXJ5U2VsZWN0b3IoJyN0cUxnU2VhcmNoUGFuZWwnKTtcbiAgICB2YXIgX2V4cGFuZEFsbCA9IHRydWU7XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFRvb2xiYXJcbiAgICB2YXIgdG9vbGJhciA9IG5ldyBUUUdyYW1VSS5Ub29sYmFyKHtcbiAgICAgICAgYmFzZUVsZW1lbnQ6IHRxTGdUb29sYmFyLFxuICAgICAgICB0b29sczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAndHFMZ1NlYXJjaEJ1dHRvbicsXG4gICAgICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tc2VhcmNoJyxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ1NlYXJjaCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAndHFOZ1VuZG8nLFxuICAgICAgICAgICAgICAgIGljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLW1lbnUtbGVmdCcsXG4gICAgICAgICAgICAgICAgbGFiZWw6ICdCYWNrJyxcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBfbmVpZ2hib3JHcmFtLnVuZG9TdGF0ZSgpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAndHFOZ1JlZG8nLFxuICAgICAgICAgICAgICAgIGljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLW1lbnUtcmlnaHQnLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnRm9yd2FyZCcsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgX25laWdoYm9yR3JhbS5yZWRvU3RhdGUoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ3RxTGdab29tSW4nLFxuICAgICAgICAgICAgICAgIGljb246ICdnbHlwaGljb24gZ2x5cGhpY29uLXpvb20taW4nLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnWm9vbSBpbicsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgX25laWdoYm9yR3JhbS56b29tKDAuMiwgeyBtYXg6IDQgfSk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICd0cUxnWm9vbU91dCcsXG4gICAgICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tem9vbS1vdXQnLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnWm9vbSBvdXQnLFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIF9uZWlnaGJvckdyYW0uem9vbSgtMC4yLCB7IG1pbjogMC4yIH0pO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnem9vbVRvRml0JyxcbiAgICAgICAgICAgICAgICBpY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1mdWxsc2NyZWVuJyxcbiAgICAgICAgICAgICAgICBsYWJlbDogJ1pvb20gdG8gZml0JyxcbiAgICAgICAgICAgICAgICBjYWxsYmFjazogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBfbmVpZ2hib3JHcmFtLnpvb20oKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ3RxTGdSZXNldCcsXG4gICAgICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcmVmcmVzaCcsXG4gICAgICAgICAgICAgICAgbGFiZWw6ICdSZXNldCBsYXlvdXQnLFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIF9uZWlnaGJvckdyYW0uZ2V0Tm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlLnNldCgnY3VzdG9tUG9zaXRpb24nLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBfbmVpZ2hib3JHcmFtLnJlZnJlc2hMYXlvdXQoKTtcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpZDogJ2V4cGFuZEFsbCcsXG4gICAgICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tcmVzaXplLWZ1bGwnLFxuICAgICAgICAgICAgICAgIGljb24yOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1yZXNpemUtc21hbGwnLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnRXhwYW5kIGxhYmVscycsXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgX25laWdoYm9yR3JhbS5mdWxsTm9kZUxhYmVscyhfZXhwYW5kQWxsKTtcbiAgICAgICAgICAgICAgICAgICAgX2V4cGFuZEFsbCA9ICFfZXhwYW5kQWxsOyAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJzxkaXYgc3R5bGU9XCJmbGV4LWdyb3c6IDFcIj48L2Rpdj4nLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGlkOiAnaW5mb1BhbmVsQnRuJyxcbiAgICAgICAgICAgICAgICBpY29uOiAnZ2x5cGhpY29uIGdseXBoaWNvbi1pbmZvLXNpZ24nLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnTm9kZSBpbmZvJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWQ6ICd0cUxnT3B0aW9uc0J1dHRvbicsXG4gICAgICAgICAgICAgICAgaWNvbjogJ2dseXBoaWNvbiBnbHlwaGljb24tbWVudS1oYW1idXJnZXInLFxuICAgICAgICAgICAgICAgIGxhYmVsOiAnT3B0aW9ucycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0pO1xuXG4gICAgbmV3IFRRR3JhbVVJLlNlYXJjaFBhbmVsKHtcbiAgICAgICAgYmFzZUVsZW1lbnQ6IHRxTGdTZWFyY2hQYW5lbCxcbiAgICAgICAgdHJpZ2dlckJ1dHRvbjogdG9vbGJhci5yb290SHRtbC5xdWVyeVNlbGVjdG9yKCcjdHFMZ1NlYXJjaEJ1dHRvbicpLFxuICAgICAgICBoZWFkZXI6ICdTZWFyY2ggdGhpcyBOZWlnaGJvckdyYW3ihKInLFxuICAgICAgICBzZWFyY2hCdXR0b25JZDogJ3RxTmdTZWFyY2hCdG4nLFxuICAgICAgICBzZWFyY2hJZDogJ3RxTmdTZWFyY2gnLFxuICAgICAgICBhY3RpdmU6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgbmV3IE9wdGlvbnNQYW5lbCh7XG4gICAgICAgIG5laWdoYm9yR3JhbTogX25laWdoYm9yR3JhbSxcbiAgICAgICAgYmFzZUVsZW1lbnQ6IHRxTGdPcHRpb25zUGFuZWwsXG4gICAgICAgIGFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHRyaWdnZXJCdXR0b246IHRvb2xiYXIucm9vdEh0bWwucXVlcnlTZWxlY3RvcignI3RxTGdPcHRpb25zQnV0dG9uJyksXG4gICAgICAgIGxlZ2VuZHM6IG9wdGlvbnMubGVnZW5kcyxcbiAgICB9KTtcblxuICAgIG5ldyBJbmZvUGFuZWwoe1xuICAgICAgICBiYXNlRWxlbWVudDogdHFMZ0luZm9QYW5lbCxcbiAgICAgICAgYWN0aXZlOiBmYWxzZSxcbiAgICAgICAgdHJpZ2dlckJ1dHRvbjogdG9vbGJhci5yb290SHRtbC5xdWVyeVNlbGVjdG9yKCcjaW5mb1BhbmVsQnRuJyksXG4gICAgICAgIG5laWdoYm9yR3JhbTogX25laWdoYm9yR3JhbSxcbiAgICB9KTtcblxufVxubW9kdWxlLmV4cG9ydHMgPSBEZWZhdWx0VUk7XG4iLCJ2YXIgZ3JhcGhFbGVtZW50cyA9IHJlcXVpcmUoJy4uL2dyYXBoRWxlbWVudHMnKTtcbnZhciBTdWJzY3JpYmFibGUgPSByZXF1aXJlKCcuLi9zdWJzY3JpcHRpb25BUEkvc3Vic2NyaWJlYWJsZScpO1xudmFyIFRRR3JhbVVJID0gcmVxdWlyZSgndmlzdWFsaXphdGlvbnMtbGlicmFyeScpO1xuXG5mdW5jdGlvbiBJbmZvUGFuZWwgKG9wdGlvbnMpIHtcbiAgICBTdWJzY3JpYmFibGUuYXBwbHkodGhpcyk7ICAgLy8gbWFrZSB0aGlzIGNsYXNzIFN1YnNjcmliYWJsZVxuXG4gICAgdmFyIGluZm9UZW1wbGF0ZSA9IG5ldyBUUUdyYW1VSS5JbmZvUGFuZWwoe1xuICAgICAgICBwbGFjZWhvbGRlcjogJ1NlbGVjdCBhIG5vZGUnLFxuICAgIH0pO1xuICAgIHZhciBfbmVpZ2hib3JHcmFtID0gb3B0aW9ucy5uZWlnaGJvckdyYW07XG5cbiAgICBUUUdyYW1VSS5GbHlpbmdQYW5lbC5hcHBseSh0aGlzLCBbe1xuICAgICAgICBiYXNlRWxlbWVudDogb3B0aW9ucy5iYXNlRWxlbWVudCxcbiAgICAgICAgYWN0aXZlOiBvcHRpb25zLmFjdGl2ZSxcbiAgICAgICAgaGVhZGVyOiAnTm9kZSBJbmZvJyxcbiAgICAgICAgdHJpZ2dlckJ1dHRvbjogb3B0aW9ucy50cmlnZ2VyQnV0dG9uLFxuICAgICAgICBlbXB0eUJvZHk6IGZhbHNlLFxuICAgICAgICBzaXplOiB7IHdpZHRoOiAnMzAwcHgnLCBoZWlnaHQ6ICc0NTBweCd9LFxuICAgICAgICBib2R5OiBpbmZvVGVtcGxhdGUsXG4gICAgfV0pO1xuXG4gICAgX25laWdoYm9yR3JhbS5vbk5vZGVTZWxlY3RlZChfc2V0U2VsZWN0ZWRFbGVtZW50KTtcblxuICAgIGluZm9UZW1wbGF0ZS5vbignc2VsZWN0ZWQtZWxlbWVudC1jaGFuZ2VkJywgZnVuY3Rpb24gKHNlbGVjdGVkSWQpIHtcbiAgICAgICAgdmFyIG5vZGVzID0gX25laWdoYm9yR3JhbS5nZXROb2RlcygpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobm9kZXNbaV0uaWQgPT09IHNlbGVjdGVkSWQpIHtcbiAgICAgICAgICAgICAgICBfbmVpZ2hib3JHcmFtLnNldFNlbGVjdGVkTm9kZShub2Rlc1tpXSk7XG4gICAgICAgICAgICAgICAgX3NldFNlbGVjdGVkRWxlbWVudChub2Rlc1tpXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7IFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBfc2V0U2VsZWN0ZWRFbGVtZW50IChlbGVtZW50KSB7XG4gICAgICAgIGlmIChlbGVtZW50ICYmIGVsZW1lbnQgaW5zdGFuY2VvZiBncmFwaEVsZW1lbnRzLk5vZGUgJiYgZWxlbWVudC5kYXRhTW9kZWwpIHtcbiAgICAgICAgICAgIHZhciBub2RlID0gZWxlbWVudDtcbiAgICAgICAgICAgIHZhciBtb2RlbCA9IG5vZGUuZGF0YU1vZGVsO1xuXG4gICAgICAgICAgICBpbmZvVGVtcGxhdGUuc2V0U2VsZWN0ZWRFbGVtZW50KHtcbiAgICAgICAgICAgICAgICBpZDogbm9kZS5pZCxcbiAgICAgICAgICAgICAgICBsYWJlbDogbW9kZWwubGFiZWwsXG4gICAgICAgICAgICAgICAgdHlwZXM6IG1vZGVsLnR5cGVJZCxcbiAgICAgICAgICAgICAgICBkYXRhOiBtb2RlbC5kYXRhLFxuICAgICAgICAgICAgICAgIHJlbGF0aW9uczogX2dldFJlbGF0aW9ucyhlbGVtZW50KSxcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbmZvVGVtcGxhdGUuc2V0U2VsZWN0ZWRFbGVtZW50KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfZ2V0UmVsYXRpb25zIChlbGVtZW50KSB7XG4gICAgICAgIHZhciBwYXJlbnROb2RlID0gZWxlbWVudC5nZXRQYXJlbnQoKTtcbiAgICAgICAgdmFyIHJlbGF0ZWROb2RlcyA9IGVsZW1lbnQuZ2V0Q2hpbGRyZW4odHJ1ZSk7XG5cbiAgICAgICAgdmFyIHNvdXJjZXMgPSByZWxhdGVkTm9kZXMuZmlsdGVyKGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICByZXR1cm4gKCFuLmdldERpcmVjdGlvblJlbGF0aXZlVG9Ob2RlKGVsZW1lbnQpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChwYXJlbnROb2RlICYmICghZWxlbWVudC5pc1JldmVyc2VEaXJlY3Rpb24oKSkpIHtcbiAgICAgICAgICAgIHNvdXJjZXMucHVzaChwYXJlbnROb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIHRhcmdldHMgPSByZWxhdGVkTm9kZXMuZmlsdGVyKGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICByZXR1cm4gKG4uZ2V0RGlyZWN0aW9uUmVsYXRpdmVUb05vZGUoZWxlbWVudCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHBhcmVudE5vZGUgJiYgKGVsZW1lbnQuaXNSZXZlcnNlRGlyZWN0aW9uKCkpKSB7XG4gICAgICAgICAgICB0YXJnZXRzLnB1c2gocGFyZW50Tm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGlmIChzb3VyY2VzICYmIHNvdXJjZXMubGVuZ3RoID4gMCB8fCB0YXJnZXRzICYmIHRhcmdldHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbmNvbWluZ3M6IHNvdXJjZXMubWFwKGZ1bmN0aW9uIChlbCkgeyBcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBlbC5pZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsOiBlbC5kYXRhTW9kZWwubGFiZWwsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgb3V0Z29pbmdzOiB0YXJnZXRzLm1hcChmdW5jdGlvbiAoZWwpIHsgXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZWwuaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYWJlbDogZWwuZGF0YU1vZGVsLmxhYmVsLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICAgICAgICAgIFxufVxubW9kdWxlLmV4cG9ydHMgPSBJbmZvUGFuZWw7XG4iLCJ2YXIgU3Vic2NyaWJhYmxlID0gcmVxdWlyZSgnLi4vc3Vic2NyaXB0aW9uQVBJL3N1YnNjcmliZWFibGUnKTtcbnZhciBUUUdyYW1VSSA9IHJlcXVpcmUoJ3Zpc3VhbGl6YXRpb25zLWxpYnJhcnknKTtcblxuZnVuY3Rpb24gT3B0aW9uc1BhbmVsIChvcHRpb25zKSB7XG4gICAgU3Vic2NyaWJhYmxlLmFwcGx5KHRoaXMpOyAgIC8vIG1ha2UgdGhpcyBjbGFzcyBTdWJzY3JpYmFibGVcblxuICAgIHZhciBfbGVnZW5kcyA9IG9wdGlvbnMubGVnZW5kcyB8fCBbXTtcbiAgICB2YXIgX25laWdoYm9yR3JhbSA9IG9wdGlvbnMubmVpZ2hib3JHcmFtO1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIFRRR3JhbVVJLkZseWluZ1BhbmVsLmFwcGx5KHRoaXMsIFt7XG4gICAgICAgIGJhc2VFbGVtZW50OiBvcHRpb25zLmJhc2VFbGVtZW50LFxuICAgICAgICBhY3RpdmU6IG9wdGlvbnMuYWN0aXZlLFxuICAgICAgICBoZWFkZXI6ICdPcHRpb25zJyxcbiAgICAgICAgdHJpZ2dlckJ1dHRvbjogb3B0aW9ucy50cmlnZ2VyQnV0dG9uLFxuICAgICAgICByZW1vdmVCYWNrZ3JvdW5kOiB0cnVlLFxuICAgICAgICBzaXplOiB7XG4gICAgICAgICAgICB3aWR0aDogJzQwMHB4JyxcbiAgICAgICAgICAgIGhlaWdodDogJzUwMHB4JyxcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogbmV3IFRRR3JhbVVJLlRhYlBhbmVsKHtcbiAgICAgICAgICAgIHRhYnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGlkOiAndHFVaUdlbmVyYWwnLFxuICAgICAgICAgICAgICAgICAgICBsYWJlbDogJ0dlbmVyYWwnLFxuICAgICAgICAgICAgICAgICAgICBib2R5OlxuICAgICAgICAgICAgICAgICAgICAgICAgJzxsYWJlbCBmb3I9XCJleHBvcnRHcm91cFwiIGNsYXNzPVwidHEtbGFiZWxcIj5FeHBvcnQgYXM8L2xhYmVsPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnPGRpdiBpZD1cImV4cG9ydEdyb3VwXCIgY2xhc3M9XCJ0cS11aS1ncm91cCB0cS11aS1leHBvcnQtZ3JvdXBcIj4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICcgICAgPGJ1dHRvbiBpZD1cInRxVWlFeHBvcnRTVkdcIiB0aXRsZT1cIkV4cG9ydCBkaWFncmFtIHRvIFNWR1wiIGNsYXNzPVwidHEtYnV0dG9uXCI+U1ZHPC9idXR0b24+JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnICAgIDxidXR0b24gaWQ9XCJ0cVVpRXhwb3J0UE5HXCIgdGl0bGU9XCJFeHBvcnQgZGlhZ3JhbSB0byBQTkdcIiBjbGFzcz1cInRxLWJ1dHRvblwiPlBORzwvYnV0dG9uPicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJzwvZGl2PiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICc8bGFiZWwgZm9yPVwiaG93VG9Vc2VHcm91cFwiIGNsYXNzPVwidHEtbGFiZWxcIj5Ib3cgdG8gdXNlPC9sYWJlbD4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJzxkaXYgaWQ9XCJob3dUb1VzZUdyb3VwXCIgY2xhc3M9XCJ0cS11aS1ncm91cCB0cS11aS1vcHQtZ3JvdXBcIj4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnICAgIDxidXR0b24gaWQ9XCJ0cVVpSGVscEJ0blwiIHRpdGxlPVwiSGVscFwiIGNsYXNzPVwidHEtYnV0dG9uXCI+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyAgICAgICAgPHNwYW4gY2xhc3M9XCJnbHlwaGljb24gZ2x5cGhpY29uLWluZm8tc2lnblwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiPjwvc3Bhbj4gICAgICAgICAgICAgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnICAgIDwvYnV0dG9uPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyAgICA8YSBjbGFzcz1cInRxLWJ1dHRvblwiIHRpdGxlPVwiRG9jdW1lbnRhdGlvblwiIGhyZWY9XCIuL2RvY3VtZW50YXRpb24vaW5kZXguaHRtbFwiPkRPQzwvYT4gICAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICc8L2Rpdj4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6ICd0cVVpTGVnZW5kcycsXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnTGVnZW5kcycsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IG5ldyBUUUdyYW1VSS5MZWdlbmRzKHtsZWdlbmRzOiBfbGVnZW5kc30pLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pLFxuICAgIH1dKTtcblxuICAgIC8vIEdlbmVyYWxcblxuICAgIHZhciBzdmdCdXR0b24gPSBzZWxmLnJvb3RIdG1sLnF1ZXJ5U2VsZWN0b3IoJyN0cVVpRXhwb3J0U1ZHJyk7XG4gICAgdmFyIHBuZ0J1dHRvbiA9IHNlbGYucm9vdEh0bWwucXVlcnlTZWxlY3RvcignI3RxVWlFeHBvcnRQTkcnKTtcbiAgICB2YXIgaGVscEJ1dHRvbiA9IHNlbGYucm9vdEh0bWwucXVlcnlTZWxlY3RvcignI3RxVWlIZWxwQnRuJyk7XG5cbiAgICBzdmdCdXR0b24ub25jbGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX25laWdoYm9yR3JhbS5leHBvcnQoe1xuICAgICAgICAgICAgdHlwZTogJ3N2ZycsXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBwbmdCdXR0b24ub25jbGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX25laWdoYm9yR3JhbS5leHBvcnQoe1xuICAgICAgICAgICAgdHlwZTogJ3BuZycsXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBoZWxwQnV0dG9uLm9uY2xpY2sgPSBvcHRpb25zLm9uUHJlc3NIZWxwO1xufVxubW9kdWxlLmV4cG9ydHMgPSBPcHRpb25zUGFuZWw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBQYWdpbmF0aW9uID0gcmVxdWlyZSgnLi9wYWdpbmF0aW9uJyk7XG5cbnZhciBDcm9zc05vZGUgPSByZXF1aXJlKCcuL2dyYXBoRWxlbWVudHMnKS5Dcm9zc05vZGU7XG5cbi8vIFRoZXkgYXJlIHVzZWQgd2hlbiB3ZSBuZWVkIHRvIGxvY2F0ZSBub2RlcyBvbiB0aGUgZ3JhcGhcbnZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICBERUZBVUxUX1BBR0VfU0laRTogNVxufTtcblxuLyoqXG4gKiBMYXlvdXRQYWdpbmF0aW9uTWFuYWdlci5cbiAqIE1hbmFnZSBwYWdpbmF0aW9uLlxuICpcbiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnM6XG4gKiAgICAgIF9sYXlvdXQ6IEdyYXBoTGF5b3V0XG4gKiAgICAgIF9vcHRpb25zOiB7XG4gKiAgICAgICAgICBERUZBVUxUX1BBR0VfU0laRTogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTE9SX0NMQVNTX0NPVU5UOiBudW1iZXIsIFxuICogICAgICAgICAgTUFYX0xBQkVMX0xFTkdUSDogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTF9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBST1dfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ1JPU1NfTk9ERV9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19NQVA6IHtcbiAqICAgICAgICAgICAgICAnc3ViQ2xhc3NPZic6IHN0cmluZywgXG4gKiAgICAgICAgICAgICAgJ3R5cGUnOiBzdHJpbmdcbiAqICAgICAgICAgIH1cbiAqICAgICAgfVxuICpcbiAqIFB1YmxpYyBtZXRob2RzOlxuICogICAgICBwYWdpbmF0ZU5vZGVzKG5vZGVzOiBBcnJheSk6IHZvaWRcbiAqICAgICAgcGFnaW5hdGVOb2RlKHJvb3ROb2RlOiBOb2RlKTogdm9pZFxuICogICAgICBoaWRlUGFnaW5hdGlvbihub2RlOiBOb2RlKTogdm9pZFxuICogICAgICBzaG93UGFnaW5hdGlvbihub2RlOiBOb2RlKTogdm9pZFxuICogICAgICByZW1vdmVQYWdpbmF0aW9uKG5vZGU6IE5vZGUpOiB2b2lkXG4gKiAgICAgIHNldFBhZ2luYXRpb25Qb3NpdGlvbihub2RlOiBOb2RlKTogdm9pZFxuICogICAgICBkZWZhdWx0RWRnZUNvbXBhcmF0b3IoZWRnZTE6IEVkZ2UsIGVkZ2UyOiBFZGdlKTogbnVtYmVyXG4gKi9cbmZ1bmN0aW9uIExheW91dFBhZ2luYXRpb25NYW5hZ2VyIChfbGF5b3V0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX29wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgREVGQVVMVF9QQUdFX1NJWkUgPSAoX29wdGlvbnMgJiYgX29wdGlvbnMuREVGQVVMVF9QQUdFX1NJWkUgIT0gdW5kZWZpbmVkID8gX29wdGlvbnMuREVGQVVMVF9QQUdFX1NJWkUgOiBkZWZhdWx0T3B0aW9ucy5ERUZBVUxUX1BBR0VfU0laRSk7XG5cbiAgICAvKipcbiAgICAgKiBJdCBkb2VzIHBhZ2luYXRpb24gZm9yIGFsbCBub2RlcyBmcm9tIHRoZSBsaXN0XG4gICAgICogQHBhcmFtIHtBcnJheX0gbm9kZXMgLSBhcnJheSBvZiBub2Rlc1xuICAgICAqL1xuICAgIHNlbGYucGFnaW5hdGVOb2RlcyA9IGZ1bmN0aW9uIChub2Rlcykge1xuICAgICAgICBpZiAobm9kZXMpIG5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHNlbGYucGFnaW5hdGVOb2RlKG5vZGUpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSXQgZG9lcyBwYWdpbmF0aW9uIGZvciB0aGUgbm9kZSBhbmQgZm9yIGhpcyBjaGlsZHJlblxuICAgICAqIEBwYXJhbSB7Tm9kZX0gcm9vdE5vZGVcbiAgICAgKi9cbiAgICBzZWxmLnBhZ2luYXRlTm9kZSA9IGZ1bmN0aW9uIChyb290Tm9kZSkge1xuICAgICAgICBpZiAoIXJvb3ROb2RlLmdldCgnaGlkZGVuJykpIHtcbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IF9wYWdpbmF0ZUFuZFNvcnRDaGlsZHJlbk9mTm9kZShyb290Tm9kZSk7XG4gICAgICAgICAgICBzZWxmLnBhZ2luYXRlTm9kZXMoY2hpbGRyZW4pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEhpZGUgdGhlIHBhZ2luYXRpb24gZWxlbWVudFxuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICAgICAqL1xuICAgIHNlbGYuaGlkZVBhZ2luYXRpb24gPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5nZXRQYWdpbmF0aW9uKCkpIHtcbiAgICAgICAgICAgIG5vZGUuZ2V0UGFnaW5hdGlvbigpLnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNob3cgdGhlIHBhZ2luYXRpb24gZWxlbWVudFxuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICAgICAqL1xuICAgIHNlbGYuc2hvd1BhZ2luYXRpb24gPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5nZXRQYWdpbmF0aW9uKCkpIHtcbiAgICAgICAgICAgIF9sYXlvdXQucHV0KG5vZGUuZ2V0UGFnaW5hdGlvbigpLCBub2RlLmlkKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBwYWdpbmF0aW9uIGVsZW1lbnQgZnJvbSB0aGUgZ3JhcGhcbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAgICAgKi9cbiAgICBzZWxmLnJlbW92ZVBhZ2luYXRpb24gPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5nZXRQYWdpbmF0aW9uKCkpIHtcbiAgICAgICAgICAgIG5vZGUuZ2V0UGFnaW5hdGlvbigpLnJlbW92ZSgpO1xuICAgICAgICAgICAgbm9kZS5zZXRQYWdpbmF0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZXMgdGhlIG5ldyBwb3NpdGlvbiBvZiB0aGUgcGFnaW5hdGlvbiBlbGVtZW50IGFuZCBtb3ZlcyBpdCB0byB0aGF0IHBvc2l0aW9uXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlXG4gICAgICovXG4gICAgc2VsZi5zZXRQYWdpbmF0aW9uUG9zaXRpb24gPSBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAobm9kZS5nZXRQYWdpbmF0aW9uKCkpIHtcbiAgICAgICAgICAgIHZhciBwYWdpbmF0aW9uID0gbm9kZS5nZXRQYWdpbmF0aW9uKCksXG4gICAgICAgICAgICAgICAgeCA9IDAsXG4gICAgICAgICAgICAgICAgeSA9IDA7XG4gICAgICAgICAgICB2YXIgc2NhbGUgPSBfbGF5b3V0LmdldFNjYWxlKCk7XG4gICAgICAgICAgICB2YXIgcGFnaW5hdGlvbldpZHRoID0gcGFnaW5hdGlvbi5nZXQoJ3NpemUnKS53aWR0aCAvIHNjYWxlLnN4O1xuICAgICAgICAgICAgdmFyIHBhZ2luYXRpb25IZWlnaHQgPSBwYWdpbmF0aW9uLmdldCgnc2l6ZScpLmhlaWdodCAvIHNjYWxlLnN5O1xuXG4gICAgICAgICAgICBpZiAocGFnaW5hdGlvbi5nZXRUeXBlKCkgPT09ICdub2RlcycpIHtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5pZCA9PT0gX2xheW91dC5nZXRSb290Tm9kZSgpLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHggPSBub2RlLnBvc2l0aW9uKCkueCArIChub2RlLmdldFNpemUoKS53aWR0aCAtIHBhZ2luYXRpb25XaWR0aCkgLyAyO1xuICAgICAgICAgICAgICAgICAgICB5ID0gbm9kZS5wb3NpdGlvbigpLnkgLSBwYWdpbmF0aW9uSGVpZ2h0IC0gKDUgLyBzY2FsZS5zeSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gbm9kZS5nZXRDaGlsZHJlbigpLmZpbHRlcihmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gIWNoaWxkLmdldCgnaGlkZGVuJykgJiYgIWNoaWxkLmdldCgnY3VzdG9tUG9zaXRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3ROb2RlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGgpIGZpcnN0Tm9kZSA9IGNoaWxkcmVuWzBdO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaXJzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHggPSBmaXJzdE5vZGUucG9zaXRpb24oKS54ICsgKGZpcnN0Tm9kZS5nZXRTaXplKCkud2lkdGggLSBwYWdpbmF0aW9uV2lkdGgpIC8gMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHkgPSBmaXJzdE5vZGUucG9zaXRpb24oKS55IC0gcGFnaW5hdGlvbkhlaWdodCAtICg1IC8gc2NhbGUuc3kpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgeCA9IG5vZGUucG9zaXRpb24oKS54IC0gcGFnaW5hdGlvbldpZHRoIC0gKDMgLyBzY2FsZS5zeCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB5ID0gbm9kZS5wb3NpdGlvbigpLnkgKyAobm9kZS5nZXRTaXplKCkuaGVpZ2h0IC0gcGFnaW5hdGlvbkhlaWdodCkgLyAyO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB4ID0gbm9kZS5wb3NpdGlvbigpLnggKyAobm9kZS5nZXREaXJlY3Rpb24oKSA/IG5vZGUuZ2V0U2l6ZSgpLndpZHRoICsgKDMgLyBzY2FsZS5zeCkgOiAtcGFnaW5hdGlvbldpZHRoIC0gKDMgLyBzY2FsZS5zeCkpO1xuICAgICAgICAgICAgICAgIHkgPSBub2RlLnBvc2l0aW9uKCkueSArIChub2RlLmdldFNpemUoKS5oZWlnaHQgLSBwYWdpbmF0aW9uSGVpZ2h0KSAvIDI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocGFnaW5hdGlvbi5wb3NpdGlvbigpLnggPT0geCAmJiBwYWdpbmF0aW9uLnBvc2l0aW9uKCkueSA9PSB5KSB7XG4gICAgICAgICAgICAgICAgcGFnaW5hdGlvbi51cGRhdGVWaWV3UG9zaXRpb24oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFnaW5hdGlvbi5zZXQoJ3Bvc2l0aW9uJywge3g6IHgsIHk6IHl9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIG5vZGUuZ2V0Q2hpbGRyZW4oKS5mb3JFYWNoKGZ1bmN0aW9uIChjaGlsZCkge1xuICAgICAgICAgICAgc2VsZi5zZXRQYWdpbmF0aW9uUG9zaXRpb24oY2hpbGQpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gY29tcGFyYXRvciBmb3Igc29ydGluZyBjaGlsZC1icmFuY2hlcyBvZiB0aGUgbm9kZVxuICAgICAqIEBwYXJhbSAge0VkZ2V9IGVkZ2UxXG4gICAgICogQHBhcmFtICB7RWRnZX0gZWRnZTJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNlbGYuZGVmYXVsdEVkZ2VDb21wYXJhdG9yID0gZnVuY3Rpb24gKGVkZ2UxLCBlZGdlMikge1xuICAgICAgICB2YXIgbm9kZTEgPSAoZWRnZTEudGFyZ2V0ID8gZWRnZTEudGFyZ2V0IDoge2RhdGFNb2RlbDoge319KTtcbiAgICAgICAgdmFyIG5vZGUyID0gKGVkZ2UyLnRhcmdldCA/IGVkZ2UyLnRhcmdldCA6IHtkYXRhTW9kZWw6IHt9fSk7XG5cbiAgICAgICAgdmFyIGEgPSBudWxsO1xuXG4gICAgICAgIGlmIChub2RlMSBpbnN0YW5jZW9mIENyb3NzTm9kZSAmJiBub2RlMS5oYXNDaGlsZHJlbigpKSB7XG4gICAgICAgICAgICBub2RlMS5zb3J0RWRnZXMoc2VsZi5kZWZhdWx0RWRnZUNvbXBhcmF0b3IpO1xuICAgICAgICAgICAgYSA9IG5vZGUxLmdldENoaWxkcmVuKClbMF0uZGF0YU1vZGVsLmxhYmVsO1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBhID0gbm9kZTEuZGF0YU1vZGVsLmxhYmVsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhKSBhID0gYS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIHZhciBiID0gbnVsbDtcbiAgICAgICAgaWYgKG5vZGUyIGluc3RhbmNlb2YgQ3Jvc3NOb2RlICYmIG5vZGUyLmhhc0NoaWxkcmVuKCkpIHtcbiAgICAgICAgICAgIG5vZGUyLnNvcnRFZGdlcyhzZWxmLmRlZmF1bHRFZGdlQ29tcGFyYXRvcik7XG4gICAgICAgICAgICBiID0gbm9kZTIuZ2V0Q2hpbGRyZW4oKVswXS5kYXRhTW9kZWwubGFiZWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBiID0gbm9kZTIuZGF0YU1vZGVsLmxhYmVsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiKSBiID0gYi50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgIGlmIChhID4gYikge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGEgPCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgb25seSBub2RlcyB3aGljaCBleGlzdHMgb24gY3VycmVudCBwYWdlIGFuZCBoaWRlcyBvdGhlciBub2Rlcy5cbiAgICAgKiBAcGFyYW0ge05vZGV9IHJvb3ROb2RlIC0gUGFyZW50IG9mIHRoZSBwYWdpbmF0ZWQgbm9kZXNcbiAgICAgKiBAcmV0dW5ycyB7QXJyYXl9IE5vZGVzIHdoaWNoIGV4aXN0cyBvbiBjdXJyZW50IHBhZ2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcGFnaW5hdGVBbmRTb3J0Q2hpbGRyZW5PZk5vZGUgKHJvb3ROb2RlKSB7XG4gICAgICAgIHZhciBtYXhQYWdlU2l6ZSA9IChyb290Tm9kZS5pc1Jvb3ROb2RlKCkgPyBERUZBVUxUX1BBR0VfU0laRSAqIDIgOiBERUZBVUxUX1BBR0VfU0laRSk7XG5cbiAgICAgICAgcm9vdE5vZGUuc29ydEVkZ2VzKHNlbGYuZGVmYXVsdEVkZ2VDb21wYXJhdG9yKTtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gcm9vdE5vZGUuZ2V0Q2hpbGRyZW4oKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChjaGlsZHJlbi5sZW5ndGggPiBtYXhQYWdlU2l6ZSkge1xuICAgICAgICAgICAgaWYgKCFyb290Tm9kZS5nZXRQYWdpbmF0aW9uKCkpIHtcbiAgICAgICAgICAgICAgICBfY3JlYXRlUGFnaW5hdGlvbihyb290Tm9kZSwgbWF4UGFnZVNpemUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIF9wYWdpbmF0ZShjaGlsZHJlbiwgcm9vdE5vZGUuZ2V0UGFnaW5hdGlvbigpLmdldFN0YXRlKCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIF9sYXlvdXQuc2hvd05vZGUobm9kZSwgdHJ1ZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogUGFnaW5hdGVzIGFycmF5IG9mIG5vZGVzLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG5vZGVzIC0gQXJyYXkgb2Ygbm9kZXNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcGFnaW5hdGlvbiAtIHsgcGFnZVNpemU6bnVtYmVyLCBjdXJQYWdlOm51bWJlciwgdG90YWxDb3VudDpudW1iZXIsIHBhZ2VDb3VudDpudW1iZXIgfVxuICAgICAqIEByZXR1bnJzIHtBcnJheX0gTm9kZXMgd2hpY2ggZXhpc3RzIG9uIGN1cnJlbnQgcGFnZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9wYWdpbmF0ZSAobm9kZXMsIHBhZ2luYXRpb24pIHtcbiAgICAgICAgdmFyIHBhZ2luYXRlZE5vZGVzID0gW107XG4gICAgICAgIHZhciBjdXJNaW4gPSBwYWdpbmF0aW9uLmN1clBhZ2UgKiBwYWdpbmF0aW9uLnBhZ2VTaXplO1xuICAgICAgICB2YXIgY3VyTWF4ID0gKHBhZ2luYXRpb24uY3VyUGFnZSArIDEpICogcGFnaW5hdGlvbi5wYWdlU2l6ZTtcbiAgICAgICAgZm9yICh2YXIgaW5kZXggPSAwOyBpbmRleCA8IG5vZGVzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgdmFyIG5vZGUgPSBub2Rlc1tpbmRleF07XG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gY3VyTWluICYmIGluZGV4IDwgY3VyTWF4KSB7XG4gICAgICAgICAgICAgICAgX2xheW91dC5zaG93Tm9kZShub2RlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBwYWdpbmF0ZWROb2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfbGF5b3V0LmhpZGVOb2RlKG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwYWdpbmF0ZWROb2RlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIHRoZSBwYWdpbmF0aW9uIGVsZW1lbnQsIGFkZHMgaXQgdG8gdGhlIGdyYXBoIGFuZCBlbWJlZHMgaXQgaW50byB0aGUgbm9kZVxuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXggLSBtYXhpbXVtIG51bWJlciBvZiBub2Rlc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9jcmVhdGVQYWdpbmF0aW9uIChub2RlLCBtYXgpIHtcbiAgICAgICAgdmFyIHBhZ2luYXRpb24sXG4gICAgICAgICAgICB0eXBlO1xuXG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgQ3Jvc3NOb2RlIHx8IG5vZGUuaWQgPT09IF9sYXlvdXQuZ2V0Um9vdE5vZGUoKS5pZCkge1xuICAgICAgICAgICAgdHlwZSA9ICdub2Rlcyc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0eXBlID0gJ2VkZ2VzJztcbiAgICAgICAgfVxuXG4gICAgICAgIHBhZ2luYXRpb24gPSBuZXcgUGFnaW5hdGlvbihub2RlLCBfbGF5b3V0LCBtYXgsIHR5cGUsIF9vcHRpb25zKTtcbiAgICAgICAgbm9kZS5zZXRQYWdpbmF0aW9uKHBhZ2luYXRpb24pO1xuICAgICAgICBfbGF5b3V0LnB1dChwYWdpbmF0aW9uLCBub2RlLmlkKTtcbiAgICB9XG59XG5tb2R1bGUuZXhwb3J0cyA9IExheW91dFBhZ2luYXRpb25NYW5hZ2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ3Jvc3NOb2RlID0gcmVxdWlyZSgnLi9ncmFwaEVsZW1lbnRzJykuQ3Jvc3NOb2RlO1xuXG4vLyBUaGV5IGFyZSB1c2VkIHdoZW4gd2UgbmVlZCAgdG8gbG9jYXRlIG5vZGVzIG9uIHRoZSBncmFwaFxudmFyIGRlZmF1bHRPcHRpb25zID0ge1xuICAgIENPTF9PRkZTRVQ6IDEwMCwgICAgICAgIC8vIEl0IG5lZWRlZCB0byBjYWxjdWxhdGUgZGlzdGFuY2UgYmV0d2VlbiBjb2x1bW5zIGluIHRoZSBncmFwaFxuICAgIFJPV19PRkZTRVQ6IDMwLCAgICAgICAgLy8gSXQgbmVlZGVkIHRvIGNhbGN1bGF0ZSBkaXN0YW5jZSBiZXR3ZWVuIHJvd3MgaW4gdGhlIGdyYXBoXG4gICAgQ1JPU1NfTk9ERV9PRkZTRVQ6IDMwLCAvLyBJdCBkZWZpbmVzIG9mZnNldCBvZiB0aGUgY3Jvc3Mgbm9kZSByZWxhdGl2ZSB0byB0aGUgbmV4dCBjb2x1bW4gcG9zaXRpb25cbiAgICBFTEVNRU5UX1dJRFRIOiAxMzBcbn07XG5cbi8qKlxuICogTGF5b3V0UG9zaXRpb25NYW5hZ2VyLlxuICogTWFuYWdlIHBvc2l0aW9uIG9mIG5vZGVzLlxuICpcbiAqIENvbnN0cnVjdG9yIHBhcmFtZXRlcnM6XG4gKiAgICAgIF9vcHRpb25zOiB7XG4gKiAgICAgICAgICBERUZBVUxUX1BBR0VfU0laRTogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTE9SX0NMQVNTX0NPVU5UOiBudW1iZXIsIFxuICogICAgICAgICAgTUFYX0xBQkVMX0xFTkdUSDogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTF9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBST1dfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ1JPU1NfTk9ERV9PRkZTRVQ6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19NQVA6IHtcbiAqICAgICAgICAgICAgICAnc3ViQ2xhc3NPZic6IHN0cmluZywgXG4gKiAgICAgICAgICAgICAgJ3R5cGUnOiBzdHJpbmdcbiAqICAgICAgICAgIH1cbiAqICAgICAgfVxuICpcbiAqIFB1YmxpYyBtZXRob2RzOlxuICogICAgICBnZXRWZXJ0aWNhbEJyYW5jaE9mZnNldFJlbGF0aXZlVG9Ob2RlKHRyZWU6IEFycmF5LCBtaWRkbGVOb2RlOiBOb2RlKTogbnVtYmVyXG4gKiAgICAgIGNhbGN1bGF0ZVRyZWUocm9vdE5vZGVzOiBBcnJheSwgY29sdW1uUG9zaXRpb246IG51bWJlciwgZGlyZWN0aW9uOiBib29sZWFuKTogdm9pZFxuICogICAgICB0cmFuc2xhdGVCcnVuY2gocm9vdE5vZGVzOiBub2RlLCB4T2Zmc2V0OiBudW1iZXIsIHlPZmZzZXQ6IG51bWJlcik6IHZvaWRcbiAqL1xuZnVuY3Rpb24gTGF5b3V0UG9zaXRpb25NYW5hZ2VyIChfb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBDT0xfT0ZGU0VUID0gKF9vcHRpb25zICYmIF9vcHRpb25zLkNPTF9PRkZTRVQgIT0gdW5kZWZpbmVkID8gX29wdGlvbnMuQ09MX09GRlNFVCA6IGRlZmF1bHRPcHRpb25zLkNPTF9PRkZTRVQpO1xuICAgIHZhciBST1dfT0ZGU0VUID0gKF9vcHRpb25zICYmIF9vcHRpb25zLlJPV19PRkZTRVQgIT0gdW5kZWZpbmVkID8gX29wdGlvbnMuUk9XX09GRlNFVCA6IGRlZmF1bHRPcHRpb25zLlJPV19PRkZTRVQpO1xuICAgIHZhciBDUk9TU19OT0RFX09GRlNFVCA9IChfb3B0aW9ucyAmJiBfb3B0aW9ucy5DUk9TU19OT0RFX09GRlNFVCAhPSB1bmRlZmluZWQgPyBfb3B0aW9ucy5DUk9TU19OT0RFX09GRlNFVCA6IGRlZmF1bHRPcHRpb25zLkNST1NTX05PREVfT0ZGU0VUKTtcblxuICAgIC8qKlxuICAgICAqIFRha2VzIGdpdmVuIG5vZGUgYXMgYSByb290IGFuZCBwbGFjZXNcbiAgICAgKiBhbGwgY2hpbGRyZW4gYXJvdW5kIHRoZSByb290IGFjY29yZGluZyB0byBvdXIgbGF5b3V0LlxuICAgICAqIEBwYXJhbSB7Tm9kZX0gcm9vdE5vZGUgLSByb290IG5vZGUgb3Igbm9kZSB3aGljaCBoYXMgY3VzdG9tIHBvc2l0aW9uXG4gICAgICogQHJldHVybiBub3RoaW5nO1xuICAgICAqL1xuICAgIHNlbGYuY2FsY3VsYXRlTGF5b3V0Rm9yTm9kZSA9IGZ1bmN0aW9uIChyb290Tm9kZSkge1xuICAgICAgICB2YXIgcG9zID0gcm9vdE5vZGUucG9zaXRpb24oKTtcbiAgICAgICAgdmFyIHRyZWVzID0gX2dldExlZnRSaWdodFRyZWVzKHJvb3ROb2RlKTtcblxuICAgICAgICB2YXIgY29sX29mZnNldCA9IChyb290Tm9kZSBpbnN0YW5jZW9mIENyb3NzTm9kZSA/IENST1NTX05PREVfT0ZGU0VUIDogQ09MX09GRlNFVCk7XG4gICAgICAgIHZhciBjb2x1bW5zID0geyAwOiAocm9vdE5vZGUgaW5zdGFuY2VvZiBDcm9zc05vZGUgPyBbXSA6IFtyb290Tm9kZV0pIH07XG4gICAgICAgIHZhciBjb2x1bW5zUiA9IF9jYWxjdWxhdGVUcmVlKHRyZWVzLnJpZ2h0VHJlZSwgcG9zLnggKyByb290Tm9kZS5nZXRTaXplKCkud2lkdGggKyBjb2xfb2Zmc2V0LCB0cnVlKTtcbiAgICAgICAgdmFyIGNvbHVtbnNMID0gX2NhbGN1bGF0ZVRyZWUodHJlZXMubGVmdFRyZWUsIHBvcy54IC0gY29sX29mZnNldCwgZmFsc2UpO1xuXG4gICAgICAgIGNvbHVtbnNSLmZvckVhY2goZnVuY3Rpb24gKGNvbHVtbiwgaW5kZXgpIHtcbiAgICAgICAgICAgIGNvbHVtbnNbaW5kZXggKyAxXSA9IGNvbHVtbjtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbHVtbnNMLmZvckVhY2goZnVuY3Rpb24gKGNvbHVtbiwgaW5kZXgpIHtcbiAgICAgICAgICAgIGNvbHVtbnNbLShpbmRleCArIDEpXSA9IGNvbHVtbjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGxlZnRCcnVuY2hUb3BPZmZzZXQgPSBfZ2V0VmVydGljYWxCcmFuY2hPZmZzZXRSZWxhdGl2ZVRvTm9kZSh0cmVlcy5sZWZ0VHJlZSwgcm9vdE5vZGUpO1xuICAgICAgICB2YXIgcmlnaHRCcnVuY2hUb3BPZmZzZXQgPSBfZ2V0VmVydGljYWxCcmFuY2hPZmZzZXRSZWxhdGl2ZVRvTm9kZSh0cmVlcy5yaWdodFRyZWUsIHJvb3ROb2RlKTtcblxuICAgICAgICBzZWxmLnRyYW5zbGF0ZUJydW5jaCh0cmVlcy5sZWZ0VHJlZSwgMCwgbGVmdEJydW5jaFRvcE9mZnNldCk7XG4gICAgICAgIHNlbGYudHJhbnNsYXRlQnJ1bmNoKHRyZWVzLnJpZ2h0VHJlZSwgMCwgcmlnaHRCcnVuY2hUb3BPZmZzZXQpO1xuXG4gICAgICAgIF9jYWxjdWxhdGVSZXZlcnNlQnJhbmNoZXNPZlRyZWUocm9vdE5vZGUsIGNvbHVtbnMpO1xuXG4gICAgICAgIHZhciBuZXdQb3MgPSByb290Tm9kZS5wb3NpdGlvbigpO1xuICAgICAgICByb290Tm9kZS5wb3NpdGlvbihwb3MueCwgcG9zLnkpO1xuXG4gICAgICAgIHNlbGYudHJhbnNsYXRlQnJ1bmNoKHRyZWVzLmxlZnRUcmVlLCAwLCBwb3MueSAtIG5ld1Bvcy55KTtcbiAgICAgICAgc2VsZi50cmFuc2xhdGVCcnVuY2godHJlZXMucmlnaHRUcmVlLCAwLCBwb3MueSAtIG5ld1Bvcy55KTtcblxuICAgICAgICBfZ2V0QWxsQ3VzdG9tUG9zaXRpb25Ob2Rlc09mVGhlUm9vdE5vZGUocm9vdE5vZGUpLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHNlbGYuY2FsY3VsYXRlTGF5b3V0Rm9yTm9kZShub2RlKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgbGVmdCBhbmQgcmlnaHQgdHJlZXMgb2YgdGhlIHJvb3Qgbm9kZVxuICAgICAqIEByZXR1cm4ge09iamVjdH0gUmVzdWx0OiB7IGxlZnRUcmVlOiBBcnJheSwgcmlnaHRUcmVlOiBBcnJheSB9O1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRMZWZ0UmlnaHRUcmVlcyAocm9vdE5vZGUpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHtsZWZ0VHJlZTogW10sIHJpZ2h0VHJlZTogW119O1xuICAgICAgICB2YXIgbm9kZXMgPSByb290Tm9kZS5nZXRWaXNpYmxlQ2hpbGRyZW4oKTtcbiAgICAgICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgaWYgKG5vZGUubm9kZVBsYWNlbWVudCgpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LmxlZnRUcmVlLnB1c2gobm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdC5yaWdodFRyZWUucHVzaChub2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSXQgcHVzaGVzIHJldmVyc2Ugbm9kZXMgaW50byB0aGUgbGF5b3V0IGFmdGVyIHRoZSBtYWluIHBhcnQgb2YgdGhlIGFsZ29yaXRobSB3YXMgZG9uZVxuICAgICAqIEBwYXJhbSB7Tm9kZX0gcm9vdE5vZGUgLSBjdXJyZW50IG5vZGUgKG9uIHRoaXMgbG9vcCBvZiB0aGUgcmVjdXJzaW9uKVxuICAgICAqIEBwYXJhbSB7IFtrZXk6IHN0cmluZ106IEFycmF5IG9mIE5vZGUgfSBjb2x1bW5zIC0gbWFwIChkZWVwIC0+IGNvbHVtbiksIHdoaWNoIGNvbnRhaW5zIGNvbHVtbnMgb2YgdGhlIG5vZGVzXG4gICAgICogIGRlZXAgPT09IDAgLT4gcm9vdE5vZGU7XG4gICAgICogIGRlZXAgPCAwIC0+IGxlZnQgdHJlZVxuICAgICAqICBkZWVwID4gMCAtPiByaWdodCB0cmVlXG4gICAgICogQHBhcmFtIGRlZXAgLSBudW1iZXIgb2YgY3VycmVudCBjb2x1bW4gZnJvbSBtYXBcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfY2FsY3VsYXRlUmV2ZXJzZUJyYW5jaGVzT2ZUcmVlIChyb290Tm9kZSwgY29sdW1ucywgZGVlcCkge1xuICAgICAgICBpZiAoIXJvb3ROb2RlKSByZXR1cm47XG4gICAgICAgIGlmIChkZWVwID09PSB1bmRlZmluZWQpIGRlZXAgPSAwO1xuXG4gICAgICAgIHZhciBub2RlRGlyZWN0aW9uID0gX2dldERpcmVjdGlvbkZvclJldmVyc2VOb2RlKHJvb3ROb2RlKTtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gcm9vdE5vZGUuZ2V0VmlzaWJsZUNoaWxkcmVuKCk7XG4gICAgICAgIHZhciBoYXNVbm5vcm1hbERpcmVjdGlvbiA9IChub2RlRGlyZWN0aW9uICYmIHJvb3ROb2RlLm5vZGVQbGFjZW1lbnQoKSkgfHwgKCFub2RlRGlyZWN0aW9uICYmICFyb290Tm9kZS5ub2RlUGxhY2VtZW50KCkpO1xuICAgICAgICB2YXIgaXNudFJvb3ROb2RlID0gIXJvb3ROb2RlLmlzUm9vdE5vZGUoKSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAhcm9vdE5vZGUuZ2V0KCdjdXN0b21Qb3NpdGlvbicpICYmXG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIXJvb3ROb2RlLmdldFByZXZOb2RlKCkuaXNSb290Tm9kZSgpICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFyb290Tm9kZS5nZXRQcmV2Tm9kZSgpLmdldCgnY3VzdG9tUG9zaXRpb24nKSAmJlxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICFyb290Tm9kZS5nZXRQYXJlbnQoKS5pc1Jvb3ROb2RlKCkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIXJvb3ROb2RlLmdldFBhcmVudCgpLmdldCgnY3VzdG9tUG9zaXRpb24nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgIHZhciBjYWxjdWxhdGVBZnRlckNoaWxkcmVuID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGlzbnRSb290Tm9kZSAmJiAoaGFzVW5ub3JtYWxEaXJlY3Rpb24gfHwgIWNvbHVtbnNbZGVlcF0gfHwgY29sdW1uc1tkZWVwXS5pbmRleE9mKHJvb3ROb2RlKSA9PT0gLTEpKSB7XG4gICAgICAgICAgICBpZighKHJvb3ROb2RlIGluc3RhbmNlb2YgQ3Jvc3NOb2RlKSkge1xuICAgICAgICAgICAgICAgIF9wdXNoTm9kZUluVGhlQ29sdW1uIChjb2x1bW5zLCBkZWVwLCByb290Tm9kZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGN1bGF0ZUFmdGVyQ2hpbGRyZW4gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgaWYgKCFub2RlLmdldCgnY3VzdG9tUG9zaXRpb24nKSkge1xuICAgICAgICAgICAgICAgIHZhciBuZXh0RGVlcCA9IChub2RlLm5vZGVQbGFjZW1lbnQoKSA/IGRlZXAgLSAxIDogZGVlcCArIDEpO1xuICAgICAgICAgICAgICAgIF9jYWxjdWxhdGVSZXZlcnNlQnJhbmNoZXNPZlRyZWUoXG4gICAgICAgICAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnMsXG4gICAgICAgICAgICAgICAgICAgIChyb290Tm9kZSBpbnN0YW5jZW9mIENyb3NzTm9kZSAmJiAgIXJvb3ROb2RlLmlzUm9vdE5vZGUoKSAmJiAhcm9vdE5vZGUuZ2V0KCdjdXN0b21Qb3NpdGlvbicpID8gZGVlcCA6IG5leHREZWVwKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChjYWxjdWxhdGVBZnRlckNoaWxkcmVuKSB7XG4gICAgICAgICAgICByb290Tm9kZS5hbGlnblJlbGF0aXZlVG9DaGlsZHJlbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSXQgcHVzaGVzIHRoZSBnaXZlbiBub2RlIGludG8gdGhlIGdpdmVuIGNvbHVtbiwgYW5kIHRyYW5zbGF0ZSB0aGUgb3ZlcmxheWVkIG5vZGVzXG4gICAgICogQHBhcmFtIHsgW2tleTogc3RyaW5nXTogQXJyYXkgb2YgTm9kZSB9IGNvbHVtbnMgLSBtYXAgKGRlZXAgLT4gY29sdW1uKSwgd2hpY2ggY29udGFpbnMgY29sdW1ucyBvZiB0aGUgbm9kZXNcbiAgICAgKiAgZGVlcCA9PT0gMCAtPiByb290Tm9kZTtcbiAgICAgKiAgZGVlcCA8IDAgLT4gbGVmdCB0cmVlXG4gICAgICogIGRlZXAgPiAwIC0+IHJpZ2h0IHRyZWVcbiAgICAgKiBAcGFyYW0gZGVlcCAtIG51bWJlciBvZiBjdXJyZW50IGNvbHVtbiBmcm9tIG1hcFxuICAgICAqIEBwYXJhbSB0YXJnZXROb2RlIC0gY3VycmVudCBub2RlIChvbiB0aGlzIGxvb3Agb2YgdGhlIHJlY3Vyc2lvbilcbiAgICAgKiAgb3IgdG8gdGhlIGZpcnN0IG5vZGUgd2l0aCBjdXN0b20gcG9zaXRpb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcHVzaE5vZGVJblRoZUNvbHVtbiAoY29sdW1ucywgZGVlcCwgdGFyZ2V0Tm9kZSkge1xuICAgICAgICBpZiAoIWNvbHVtbnMpIHJldHVybjtcbiAgICAgICAgaWYgKCFjb2x1bW5zW2RlZXBdKSBjb2x1bW5zW2RlZXBdID0gW107XG4gICAgICAgIHZhciBjb2x1bW4gPWNvbHVtbnNbZGVlcF07XG5cbiAgICAgICAgdmFyIHBhcmVudCA9IHRhcmdldE5vZGUuZ2V0UGFyZW50KCk7XG4gICAgICAgIHZhciBwYXJlbnRQb3MgPSBwYXJlbnQucG9zaXRpb24oKTtcbiAgICAgICAgdmFyIGluZGV4ID0gX2dldFBsYWNlSW5Db2x1bW4oY29sdW1uLCBwYXJlbnQpO1xuICAgICAgICB2YXIgYmFzZUVsZW1lbnQgPSBjb2x1bW5baW5kZXhdO1xuICAgICAgICBpZiAoYmFzZUVsZW1lbnQpIHtcbiAgICAgICAgICAgIHZhciBiYXNlRWxlbWVudFBvc2l0aW9uID0gYmFzZUVsZW1lbnQucG9zaXRpb24oKTtcbiAgICAgICAgICAgIHZhciB0b01vdmVEb3duID0gW107XG4gICAgICAgICAgICB2YXIgdG9Nb3ZlVXAgPSBbXTtcbiAgICAgICAgICAgIHZhciBiZWZvcmUgPSBfYWZ0ZXJPckJlZm9yZShiYXNlRWxlbWVudFBvc2l0aW9uLCBwYXJlbnQsIGNvbHVtbik7XG5cbiAgICAgICAgICAgIGNvbHVtbi5mb3JFYWNoKGZ1bmN0aW9uIChub2RlLCBpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGkgPiBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICB0b01vdmVEb3duLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChpIDwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9Nb3ZlVXAucHVzaChub2RlKTsgXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbHVtbi5zcGxpY2UoKGJlZm9yZSA/IGluZGV4IDogaW5kZXggKyAxKSwgMCwgdGFyZ2V0Tm9kZSk7XG4gICAgICAgICAgICB0YXJnZXROb2RlLnBvc2l0aW9uKGJhc2VFbGVtZW50UG9zaXRpb24ueCwgcGFyZW50UG9zLnkpO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgIChiZWZvcmUgJiYgcGFyZW50UG9zLnkgPj0gYmFzZUVsZW1lbnRQb3NpdGlvbi55IHx8ICFiZWZvcmUgJiYgcGFyZW50UG9zLnkgPD0gYmFzZUVsZW1lbnRQb3NpdGlvbi55KSB8fFxuICAgICAgICAgICAgICAgIChfaGl0VGVzdFdpdGhOZWlnYm91cnModGFyZ2V0Tm9kZSwgY29sdW1uKSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHZhciB0YXJnZXRQb3MgPSB7XG4gICAgICAgICAgICAgICAgICAgIHg6IGJhc2VFbGVtZW50UG9zaXRpb24ueCxcbiAgICAgICAgICAgICAgICAgICAgeTogYmFzZUVsZW1lbnRQb3NpdGlvbi55ICsgKCFiZWZvcmUgPyBST1dfT0ZGU0VUICsgdGFyZ2V0Tm9kZS5nZXRTaXplKCkuaGVpZ2h0IDogLShST1dfT0ZGU0VUICsgdGFyZ2V0Tm9kZS5nZXRTaXplKCkuaGVpZ2h0KSlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHRhcmdldE5vZGUucG9zaXRpb24odGFyZ2V0UG9zLngsIHRhcmdldFBvcy55KTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0UG9zLnkgPD0gcGFyZW50UG9zLnkgJiYgdG9Nb3ZlVXAubGVuZ3RoID4gMCAmJiBfaGl0VGVzdCh0b01vdmVVcFt0b01vdmVVcC5sZW5ndGggLSAxXSwgdGFyZ2V0Tm9kZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IHRvTW92ZVVwLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbm9kZSA9IHRvTW92ZVVwW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHByZXYgPSB0b01vdmVVcFtpICsgMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpID09PSB0b01vdmVVcC5sZW5ndGggLSAxICYmIF9oaXRUZXN0IChub2RlLCB0YXJnZXROb2RlKSB8fCBfaGl0VGVzdCAobm9kZSwgcHJldikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgb2Zmc2V0ID0gKChwcmV2IHx8IHRhcmdldE5vZGUpLnBvc2l0aW9uKCkueSAtIFJPV19PRkZTRVQgLSBub2RlLmdldFNpemUoKS5oZWlnaHQpIC0gbm9kZS5wb3NpdGlvbigpLnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3RyYW5zbGF0ZVJldmVyc2VOb2RlKG5vZGUsIDAsIG9mZnNldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHRhcmdldFBvcy55ID4gcGFyZW50UG9zLnkgJiYgdG9Nb3ZlRG93bi5sZW5ndGggPiAwICYmIF9oaXRUZXN0KHRvTW92ZURvd25bMF0sIHRhcmdldE5vZGUpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRvTW92ZURvd24uZm9yRWFjaChmdW5jdGlvbiAobm9kZSwgaSwgYXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgcHJldiA9IGFycltpIC0gMV07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpPT09MCAmJiBfaGl0VGVzdCAobm9kZSwgdGFyZ2V0Tm9kZSkgfHwgX2hpdFRlc3QgKG5vZGUsIHByZXYpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG9mZnNldCA9ICgocHJldiB8fCB0YXJnZXROb2RlKS5wb3NpdGlvbigpLnkgKyAgUk9XX09GRlNFVCArIHRhcmdldE5vZGUuZ2V0U2l6ZSgpLmhlaWdodCkgLSBub2RlLnBvc2l0aW9uKCkueTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfdHJhbnNsYXRlUmV2ZXJzZU5vZGUobm9kZSwgMCwgb2Zmc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgbmV4dENvbHVtblBvc2l0aW9uID0gXG4gICAgICAgICAgICAgICAgcGFyZW50UG9zLnggKyAodGFyZ2V0Tm9kZS5ub2RlUGxhY2VtZW50KCkgPyAtKHRhcmdldE5vZGUuZ2V0U2l6ZSgpLndpZHRoICsgQ09MX09GRlNFVCkgOlxuICAgICAgICAgICAgICAgICh0YXJnZXROb2RlLmdldFNpemUoKS53aWR0aCArIENPTF9PRkZTRVQpKTtcbiAgICAgICAgICAgIHZhciBuZXh0Q29sdW1uUG9zaXRpb25Gb3JOb2RlID0gdGFyZ2V0Tm9kZSBpbnN0YW5jZW9mIENyb3NzTm9kZSA/IHBhcmVudFBvcy54IDogbmV4dENvbHVtblBvc2l0aW9uO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB0YXJnZXROb2RlLnBvc2l0aW9uKG5leHRDb2x1bW5Qb3NpdGlvbkZvck5vZGUsIHBhcmVudFBvcy55KTtcbiAgICAgICAgICAgIHRhcmdldE5vZGUucHVzaGVkQWZ0ZXJMYXlvdXQgPSB0cnVlO1xuICAgICAgICAgICAgY29sdW1uLnB1c2godGFyZ2V0Tm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvbHVtbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJdCdzIGtpbmQgb2Ygc2hlbGwgZm9yIHRoZSBmdW5jdGlvbiBcImdldERpcmVjdGlvblwiIFxuICAgICAqICBidXQgaXQncyBub3QgdGFrZXMgKHJvb3Qgbm9kZXMgLyBjdXN0b20gcG9zaXRpb25lZCksIGJ1dCBpdCB0YWtlc1xuICAgICAqICB0aGUgZmlyc3QgY2hpbGRyZW4gb2YgdGhpcyBub2RlLCBhbmQgcmV0dXJuIG9yaWVudGF0aW9uXG4gICAgICogQHBhcmFtIHRhcmdldE5vZGUgLSBjdXJyZW50IG5vZGUgKG9uIHRoaXMgbG9vcCBvZiB0aGUgcmVjdXJzaW9uKVxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBvcmllbnRhdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXREaXJlY3Rpb25Gb3JSZXZlcnNlTm9kZSAobm9kZSkge1xuICAgICAgICB2YXIgcGFyZW50ID0gbm9kZS5nZXRQcmV2Tm9kZSgpO1xuICAgICAgICBpZiAoKCFwYXJlbnQgfHwgcGFyZW50LmlzUm9vdE5vZGUoKSB8fCBwYXJlbnQuZ2V0KCdjdXN0b21Qb3NpdGlvbicpKSAmJiAoIW5vZGUubm9kZVBsYWNlbWVudCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGUuZ2V0RGlyZWN0aW9uUmVsYXRpdmVUb05vZGUocGFyZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBfZ2V0RGlyZWN0aW9uRm9yUmV2ZXJzZU5vZGUocGFyZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuc3dlciBmb3IgcXVlc3Rpb246IFwiUHVzaCB0aGUgbmV3IG5vZGUgYWZ0ZXIgb3IgYmVmb3JlIHRoZSBleGlzdGVkIG5vZGU/XCJcbiAgICAgKiBAcGFyYW0ge1BvaW50fSBiYXNlRWxlbWVudFBvcyAtIGV4aXN0ZWQgbm9kZVxuICAgICAqIEBwYXJhbSB7Tm9kZX0gcGFyZW50IC0gcGFyZW50IG5vZGUgXG4gICAgICogQHBhcmFtIHtBcnJheSBvZiBOb2RlfSBjb2x1bW5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gYmVmb3JlIC0+IHRydWUgfCBhZnJlciAtPiBmYWxzZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9hZnRlck9yQmVmb3JlIChiYXNlRWxlbWVudFBvcywgcGFyZW50LCBjb2x1bW4pIHtcbiAgICAgICAgdmFyIHBhcmVudFBvcyA9IHBhcmVudC5wb3NpdGlvbigpO1xuICAgICAgICB2YXIgYmVmb3JlID0gcGFyZW50UG9zLnkgLSBiYXNlRWxlbWVudFBvcy55O1xuICAgICAgICB2YXIgYWZ0ZXIgPSBiYXNlRWxlbWVudFBvcy55IC0gcGFyZW50UG9zLnk7XG5cbiAgICAgICAgcGFyZW50LmdldFZpc2libGVDaGlsZHJlbigpLmZvckVhY2goZnVuY3Rpb24gKGN1ck5vZGUpIHtcbiAgICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSBfZ2V0RGlyZWN0aW9uRm9yUmV2ZXJzZU5vZGUoY3VyTm9kZSk7XG4gICAgICAgICAgICBpZiAoY29sdW1uLmluZGV4T2YoY3VyTm9kZSkgIT09IC0xICYmIChkaXJlY3Rpb24gJiYgY3VyTm9kZS5ub2RlUGxhY2VtZW50KCkgfHwgIShkaXJlY3Rpb24gfHwgY3VyTm9kZS5ub2RlUGxhY2VtZW50KCkpKSkge1xuICAgICAgICAgICAgICAgIHZhciBjdXJOb2RlUG9zZSA9IGN1ck5vZGUucG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoY3VyTm9kZVBvc2UueSA+IGJhc2VFbGVtZW50UG9zLnkpIHtcbiAgICAgICAgICAgICAgICAgICAgYWZ0ZXIgKz0gKGN1ck5vZGVQb3NlLnkgLSBiYXNlRWxlbWVudFBvcy55KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGN1ck5vZGVQb3NlLnkgPCBiYXNlRWxlbWVudFBvcy55KSB7XG4gICAgICAgICAgICAgICAgICAgIGJlZm9yZSArPSAoYmFzZUVsZW1lbnRQb3MueSAtIGN1ck5vZGVQb3NlLnkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBiZWZvcmUgPCBhZnRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZWxlY3RzIHRoZSBzdWl0YWJsZSBwbGFjZSBpbiB0aGUgY29sdW1uIGZvciB0aGUgbmV3IG5vZGUuXG4gICAgICogQHBhcmFtIHtBcnJheSBvZiBOb2RlfSBjb2x1bW5cbiAgICAgKiBAcGFyYW0ge05vZGV9IHBhcmVudCAtIHBhcmVudCBOb2RlXG4gICAgICogQHJldHVybnMge251bWJlcn0gaW5kZXggLSBpbmRleCBpbiB0aGUgY29sdW1uIGFycmF5XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldFBsYWNlSW5Db2x1bW4gKGNvbHVtbiwgcGFyZW50KSB7XG4gICAgICAgIGlmIChjb2x1bW4ubGVuZ3RoID09PSAwKSByZXR1cm4gLTE7XG4gICAgICAgIHZhciBwYXJlbnRQb3MgPSBwYXJlbnQucG9zaXRpb24oKTtcbiAgICAgICAgdmFyIGluZGV4ID0gMDtcbiAgICAgICAgdmFyIGN1clZhbCA9IGNvbHVtbltpbmRleF0ucG9zaXRpb24ueSA+PSBwYXJlbnRQb3MueTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2x1bW4ubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgcG9zID0gY29sdW1uW2ldLnBvc2l0aW9uKCk7XG4gICAgICAgICAgICB2YXIgbmV3VmFsID0gcG9zLnkgPj0gcGFyZW50UG9zLnk7XG4gICAgICAgICAgICBpZiAobmV3VmFsICE9PSBjdXJWYWwpIHtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHBvcy55IDw9IHBhcmVudFBvcy55KSBpbmRleCA9IGk7XG4gICAgICAgICAgICBjdXJWYWwgPSBuZXdWYWw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGV4ID09PSBjb2x1bW4ubGVuZ3RoIC0gMSAmJiBjb2x1bW5bY29sdW1uLmxlbmd0aCAtIDFdLnBvc2l0aW9uLnkgPD0gcGFyZW50UG9zLnkpIGluZGV4ID0gaTtcbiAgICAgICAgcmV0dXJuIGluZGV4O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZXMgbm9kZSwgYW5kIGFsaWduIHRoZSByb290IGNyb3NzTm9kZSBpZiBleGlzdC5cbiAgICAgKiBAcGFyYW0ge05vZGV9IHRhcmdldE5vZGUgLSB0cmFuc2xhdGVkIE5vZGVcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geE9mZnNldCAtIENvbHVtbiBvZmZzZXQgKG9uIHgtYXhpcylcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geU9mZnNldCAtIFJvdyBvZmZzZXQgKG9uIHktYXhpcylcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfdHJhbnNsYXRlUmV2ZXJzZU5vZGUgKHRhcmdldE5vZGUsIHhPZmZzZXQsIHlPZmZzZXQpIHtcbiAgICAgICAgdGFyZ2V0Tm9kZS5wb3NpdGlvbihcbiAgICAgICAgICAgIHRhcmdldE5vZGUucG9zaXRpb24oKS54ICsgeE9mZnNldCxcbiAgICAgICAgICAgIHRhcmdldE5vZGUucG9zaXRpb24oKS55ICsgeU9mZnNldFxuICAgICAgICApO1xuICAgICAgICB2YXIgcHJldk5vZGUgPSB0YXJnZXROb2RlLmdldFByZXZOb2RlKCk7XG4gICAgICAgIGlmIChwcmV2Tm9kZSAmJiBwcmV2Tm9kZSBpbnN0YW5jZW9mIENyb3NzTm9kZSkgcHJldk5vZGUuYWxpZ25SZWxhdGl2ZVRvQ2hpbGRyZW4oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgcG9zaXRpb25zIG9mIGFsbCBlbGVtZW50cyBvZiB0aGUgdHJlZS5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSByb290Tm9kZXMgLSBsaXN0IG9mIHJvb3Qgbm9kZXNcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29sdW1uUG9zaXRpb24gLSBmaXJzdCBjb2x1bW4gb2Zmc2V0IG9uIHgtYXhpc1xuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlyZWN0aW9uIC0gRGlyZWN0aW9uOiBmYWxzZSA9PiBsZWZ0OyB0cnVlID0+IHJpZ2h0XG4gICAgICogQHJldHVybnMge0FycmF5IG9mIEFycmF5IG9mIE5vZGVzfSBFbGVtZW50cyBieSBjb2x1bW5zXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NhbGN1bGF0ZVRyZWUgKHJvb3ROb2RlcywgY29sdW1uUG9zaXRpb24sIGRpcmVjdGlvbikge1xuICAgICAgICB2YXIgY29sdW1ucyA9IFtdO1xuICAgICAgICBpZiAoIXJvb3ROb2RlcyB8fCByb290Tm9kZXMubGVuZ3RoID09IDApIHJldHVybiBjb2x1bW5zO1xuXG4gICAgICAgIHZhciBmaWx0ZXJlZFJvb3ROb2RlcyA9IHJvb3ROb2Rlcy5maWx0ZXIoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiAhbm9kZS5nZXQoJ2N1c3RvbVBvc2l0aW9uJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgZmlsdGVyZWRSb290Tm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgX2NhbGN1bGF0ZUJyYW5jaChcbiAgICAgICAgICAgICAgICBub2RlLFxuICAgICAgICAgICAgICAgIGNvbHVtblBvc2l0aW9uLFxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICAwLFxuICAgICAgICAgICAgICAgIGNvbHVtbnNcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBjb2x1bW5zO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYW5zbGF0ZSBhbGwgZWxlbWVudHMgb2YgdGhlIGJyYW5jaC5cbiAgICAgKiBAcGFyYW0ge0FycmF5fSByb290Tm9kZXMgLSBSb290IG5vZGVzIG9mIHRoZSBicmFuY2hcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geE9mZnNldCAtIENvbHVtbiBvZmZzZXQgKG9uIHgtYXhpcylcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geU9mZnNldCAtIFJvdyBvZmZzZXQgKG9uIHktYXhpcylcbiAgICAgKi9cbiAgICBzZWxmLnRyYW5zbGF0ZUJydW5jaCA9IGZ1bmN0aW9uIChyb290Tm9kZXMsIHhPZmZzZXQsIHlPZmZzZXQpIHtcbiAgICAgICAgaWYgKCFyb290Tm9kZXMgfHwgcm9vdE5vZGVzLmxlbmd0aCA9PSAwKSByZXR1cm47XG4gICAgICAgIHZhciBub2RlcyA9IHJvb3ROb2Rlcy5maWx0ZXIoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiAhbm9kZS5nZXQoJ2N1c3RvbVBvc2l0aW9uJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIHNlbGYudHJhbnNsYXRlQnJ1bmNoKG5vZGUuZ2V0VmlzaWJsZUNoaWxkcmVuKCksIHhPZmZzZXQsIHlPZmZzZXQpO1xuICAgICAgICAgICAgbm9kZS5wb3NpdGlvbihcbiAgICAgICAgICAgICAgICBub2RlLnBvc2l0aW9uKCkueCArIHhPZmZzZXQsXG4gICAgICAgICAgICAgICAgbm9kZS5wb3NpdGlvbigpLnkgKyB5T2Zmc2V0XG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB2ZXJ0aWNhbCBvZmZzZXQgb2YgdGhlIHRyZWUgcmVsYXRpdmUgdG8gdGhlIHJvb3Qgbm9kZVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHRyZWUgLSBsaXN0IG9mIHJvb3Qgbm9kZXNcbiAgICAgKiBAcGFyYW0ge05vZGV9IG1pZGRsZU5vZGUgLSBXZSBkbyBhbGlnbiByZWxhdGl2ZSB0byB0aGlzIG5vZGVcbiAgICAgKiBAcmV0dXJuIHtudW1iZXJ9IFZlcnRpY2FsIGJyYW5jaCBvZmZzZXRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0VmVydGljYWxCcmFuY2hPZmZzZXRSZWxhdGl2ZVRvTm9kZSAodHJlZSwgbWlkZGxlTm9kZSkge1xuICAgICAgICBpZiAodHJlZSAmJiB0cmVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyZWUgPSB0cmVlLmZpbHRlcihmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAhbm9kZS5nZXQoJ2N1c3RvbVBvc2l0aW9uJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICh0cmVlLmxlbmd0aCA9PSAwKSByZXR1cm4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGZpcnN0Q2hpZWxkID0gdHJlZVswXTtcbiAgICAgICAgaWYgKGZpcnN0Q2hpZWxkIGluc3RhbmNlb2YgQ3Jvc3NOb2RlKSB7XG4gICAgICAgICAgICB2YXIgZmlyc3ROb2RlQ2hpbGRyZW4gPSBmaXJzdENoaWVsZC5nZXRWaXNpYmxlQ2hpbGRyZW4odHJ1ZSkuZmlsdGVyKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICFub2RlLmdldCgnY3VzdG9tUG9zaXRpb24nKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGZpcnN0Tm9kZUNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZpcnN0Tm9kZUNoaWxkcmVuW2ldICYmICFmaXJzdE5vZGVDaGlsZHJlbltpXS5nZXQoJ2hpZGRlbicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpcnN0Q2hpZWxkID0gZmlyc3ROb2RlQ2hpbGRyZW5baV07XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsYXN0Q2hpZWxkID0gdHJlZVt0cmVlLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAobGFzdENoaWVsZCBpbnN0YW5jZW9mIENyb3NzTm9kZSkge1xuICAgICAgICAgICAgdmFyIGxhc3ROb2RlQ2hpbGRyZW4gPSBsYXN0Q2hpZWxkLmdldFZpc2libGVDaGlsZHJlbih0cnVlKS5maWx0ZXIoZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gIW5vZGUuZ2V0KCdjdXN0b21Qb3NpdGlvbicpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGZvciAoaSA9IGxhc3ROb2RlQ2hpbGRyZW4ubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICBpZiAobGFzdE5vZGVDaGlsZHJlbltpXSAmJiAhbGFzdE5vZGVDaGlsZHJlbltpXS5nZXQoJ2hpZGRlbicpKSB7XG4gICAgICAgICAgICAgICAgICAgIGxhc3RDaGllbGQgPSBsYXN0Tm9kZUNoaWxkcmVuW2ldO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWxhc3RDaGllbGQgfHwgIWZpcnN0Q2hpZWxkKSByZXR1cm4gMDtcbiAgICAgICAgdmFyIGNvbHVtbkNlbnRlciA9IChsYXN0Q2hpZWxkLnBvc2l0aW9uKCkueSArIGxhc3RDaGllbGQuZ2V0U2l6ZSgpLmhlaWdodCArIGZpcnN0Q2hpZWxkLnBvc2l0aW9uKCkueSkgLyAyO1xuICAgICAgICByZXR1cm4gbWlkZGxlTm9kZS5wb3NpdGlvbigpLnkgKyBtaWRkbGVOb2RlLmdldFNpemUoKS5oZWlnaHQgLyAyIC0gY29sdW1uQ2VudGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGN1bGF0ZSBwb3NpdGlvbnMgb2YgYWxsIGVsZW1lbnRzIG9mIGJyYW5jaC5cbiAgICAgKiBAcGFyYW0ge05vZGV9IHJvb3ROb2RlIC0gUm9vdCBub2RlIG9mIHRoZSBicmFuY2hcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gY29sdW1uUG9zaXRpb24gLSBDb2x1bW4gb2Zmc2V0IChvbiB4LWF4aXMpXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJvd1Bvc2l0aW9uIC0gUm93IG9mZnNldCAob24geS1heGlzKVxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gZGlyZWN0aW9uIC0gRGlyZWN0aW9uOiBmYWxzZSA9PiBsZWZ0OyB0cnVlID0+IHJpZ2h0XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGRlZXAgLSBjb2x1bW4gbnVtYmVyXG4gICAgICogQHBhcmFtIHtBcnJheX0gY29sdW1ucyAtIGNvbHVtbnMgbGlzdFxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IEhlaWdodCBvZiB0aGUgY29sdW1uLCB3aGljaCBpbmNsdWRlIGhlaWdodCBvZiB0aGUgY2hpbGQgY29sdW1uc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9jYWxjdWxhdGVCcmFuY2ggKHJvb3ROb2RlLCBjb2x1bW5Qb3NpdGlvbiwgZGlyZWN0aW9uLCBkZWVwLCBjb2x1bW5zKSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IHJvb3ROb2RlLmdldFZpc2libGVDaGlsZHJlbigpO1xuICAgICAgICB2YXIgZmlsdGVyZWRDaGlsZHJlbiA9IGNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuICFub2RlLmdldCgnY3VzdG9tUG9zaXRpb24nKSAmJiAoZGlyZWN0aW9uICYmICFub2RlLm5vZGVQbGFjZW1lbnQoKSB8fCBub2RlLm5vZGVQbGFjZW1lbnQoKSAmJiAhZGlyZWN0aW9uKTtcbiAgICAgICAgfSk7IC8vIGZpbHRlciBhbGwgbm9kZXMgd2l0aCBjdXN0b20gcG9zaXRpb25cblxuICAgICAgICB2YXIgY29sdW1uV2lkdGggPSByb290Tm9kZS5nZXRTaXplKCkud2lkdGg7IC8vIHNldCBzdGFydGluZyB3aWR0aCBmb3IgdGhlIGNvbHVtbiBmb3IgY2FzZSB3aGVuIHRoZXJlIGFyZSBubyBjaGlsZHJlblxuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBuZXh0IGNvbHVtbiBwb3NpdGlvbiAoaWYgb25lIG9mIHRoZSBjaGlsZHJlbiBpcyBjcm9zcyBub2RlIHRoZW4gbmV4dCBjb2x1bW4gcG9zaXRpb24gaXMgY3VycmVudCBjb2x1bW4gcG9zaXRpb24pXG4gICAgICAgIHZhciBuZXh0Q29sdW1uUG9zaXRpb24gPSBjb2x1bW5Qb3NpdGlvbiArIChkaXJlY3Rpb24gPyAoY29sdW1uV2lkdGggKyBDT0xfT0ZGU0VUKSA6IC0oY29sdW1uV2lkdGggKyBDT0xfT0ZGU0VUKSk7XG5cbiAgICAgICAgLy8gRW50ZXIgdGhlIHJlY3Vyc2lvbiBieSBub2RlcyB3aXRob3V0IGN1c3RvbWUgcG9zaXRpb24gYW5kIGNhbGN1bGF0aW9uIGhlaWdodCBvZiBjaGlsZCBjb2x1bW5cbiAgICAgICAgZmlsdGVyZWRDaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAvLyBpZiB0aGVyZSBpcyBjcm9zcyBub2RlIHRoZW4gaGlzdCBjaGlsZHJlbiBwbGFjaW5nIGluIHNhbWUgY29sdW1uIHdpdGggcGFyZW50LCBidXQgcGFyZW50IChjcm9zc05vZGUpIGhhcyBvZmZzZXRcbiAgICAgICAgICAgIHZhciBuZXh0Q29sdW1uUG9zaXRpb25Gb3JOb2RlID0gcm9vdE5vZGUgaW5zdGFuY2VvZiBDcm9zc05vZGUgPyBjb2x1bW5Qb3NpdGlvbiA6IG5leHRDb2x1bW5Qb3NpdGlvbjtcbiAgICAgICAgICAgIF9jYWxjdWxhdGVCcmFuY2goXG4gICAgICAgICAgICAgICAgbm9kZSxcbiAgICAgICAgICAgICAgICBuZXh0Q29sdW1uUG9zaXRpb25Gb3JOb2RlLFxuICAgICAgICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICAocm9vdE5vZGUgaW5zdGFuY2VvZiBDcm9zc05vZGUgPyBkZWVwIDogZGVlcCArIDEpLCAvLyBpZiBub2RlIGlzIGNyb3NzIG5vZGUgdGhlbiB3ZSBkb24ndCBpbmNyZWFzZSBjb2x1bW4gaW5kZXhcbiAgICAgICAgICAgICAgICBjb2x1bW5zXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTZXQgcG9zaXRpb24gb2YgdGhlIGN1cnJlbnQgbm9kZVxuICAgICAgICBfc2V0UG9zaXRpb25PZlRoZU5vZGUoXG4gICAgICAgICAgICBmaWx0ZXJlZENoaWxkcmVuLFxuICAgICAgICAgICAgcm9vdE5vZGUsXG4gICAgICAgICAgICBjb2x1bW5Qb3NpdGlvbixcbiAgICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICAgIGRlZXAsXG4gICAgICAgICAgICBjb2x1bW5zXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBub2RlIHBvc2l0aW9uIGFuZCByZXR1cm4gcmVjdXJzaW9uIHJlc3VsdC1kYXRhIGZvciBmdW5jdGlvbiBfY2FsY3VsYXRlQnJhbmNoLlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGZpbHRlcmVkQ2hpbGRyZW4gLSBzb3J0ZWQsIHBhZ2luYXRlZCwgZmlsdGVyZWQgY2hpbGRyZW4gbGlzdFxuICAgICAqIEBwYXJhbSB7Tm9kZX0gcm9vdE5vZGUgLSBSb290IG5vZGUgb2YgdGhlIGJyYW5jaFxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb2x1bW5Qb3NpdGlvbiAtIENvbHVtbiBvZmZzZXQgKG9uIHgtYXhpcylcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcm93UG9zaXRpb24gLSBSb3cgb2Zmc2V0IChvbiB5LWF4aXMpXG4gICAgICogQHBhcmFtIHtib29sZWFufSBkaXJlY3Rpb24gLSBEaXJlY3Rpb246IGZhbHNlID0+IGxlZnQ7IHRydWUgPT4gcmlnaHRcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZGVlcCAtIGNvbHVtbiBudW1iZXJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjb2x1bW5zIC0gY29sdW1ucyBsaXN0XG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGNoaWxkcmVuc0NvbHVtbkhlaWdodCAtIEhlaWdodCBvZiB0aGUgY2hpbGQgY29sdW1uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBhYmxlVG9Db25kZW5zaW5nIC0gdHJ1ZSBpZiBub2RlIGNhbiBiZSByYWlzZWQgdG8gdGhlIG5vZGVzIHdoaWNoIGxvY2F0ZWQgaW4gdGhpcyBjb2x1bW4gYWJvdmUgY3VycmVudCBub2RlXG4gICAgICogQHJldHVybnMge251bWJlcn0gSGVpZ2h0IG9mIHRoZSBjb2x1bW4sIHdoaWNoIGluY2x1ZGUgaGVpZ2h0IG9mIHRoZSBjaGlsZCBjb2x1bW5zXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3NldFBvc2l0aW9uT2ZUaGVOb2RlIChmaWx0ZXJlZENoaWxkcmVuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb290Tm9kZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uUG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVlcCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1ucykge1xuICAgICAgICBpZiAoIWNvbHVtbnNbZGVlcF0pIGNvbHVtbnNbZGVlcF0gPSBbXTsgLy8gaWYgdGhlcmUgYXJlbid0IGVsZW1lbnRzIGluIHRoaXMgY29sdW1uIGNyZWF0ZSBhcnJheVxuICAgICAgICB2YXIgY29sdW1uID0gY29sdW1uc1tkZWVwXTtcbiAgICAgICAgdmFyIGlzQ3Jvc3NOb2RlID0gcm9vdE5vZGUgaW5zdGFuY2VvZiBDcm9zc05vZGU7XG5cbiAgICAgICAgdmFyIHhQb3NpdGlvbiA9IGNvbHVtblBvc2l0aW9uIC0gKCFkaXJlY3Rpb24gPyByb290Tm9kZS5nZXRTaXplKCkud2lkdGggOiAwKTtcbiAgICAgICAgeFBvc2l0aW9uID0gKGlzQ3Jvc3NOb2RlID9cbiAgICAgICAgICAgICh4UG9zaXRpb24gKyAoZGlyZWN0aW9uID9cbiAgICAgICAgICAgICAgICAtQ1JPU1NfTk9ERV9PRkZTRVQgOlxuICAgICAgICAgICAgICAgICtDUk9TU19OT0RFX09GRlNFVCkpIDpcbiAgICAgICAgICAgIHhQb3NpdGlvbik7XG5cbiAgICAgICAgdmFyIHlQb3NpdGlvbiA9IDA7XG5cbiAgICAgICAgdmFyIHlQb3NSZWFsdGl2ZVRvQ2hpbGRyZW4gPSAwO1xuICAgICAgICBpZiAoZmlsdGVyZWRDaGlsZHJlbi5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgbGFzdENoaWVsZCA9IGZpbHRlcmVkQ2hpbGRyZW5bZmlsdGVyZWRDaGlsZHJlbi5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgIHZhciBmaXJzdENoaWVsZCA9IGZpbHRlcmVkQ2hpbGRyZW5bMF07XG4gICAgICAgICAgICB5UG9zUmVhbHRpdmVUb0NoaWxkcmVuID0gKFxuICAgICAgICAgICAgICAgIGxhc3RDaGllbGQucG9zaXRpb24oKS55XG4gICAgICAgICAgICAgICAgKyBmaXJzdENoaWVsZC5nZXRTaXplKCkuaGVpZ2h0XG4gICAgICAgICAgICAgICAgKyBmaXJzdENoaWVsZC5wb3NpdGlvbigpLnlcbiAgICAgICAgICAgICAgICAtIHJvb3ROb2RlLmdldFNpemUoKS5oZWlnaHRcbiAgICAgICAgICAgICkgLyAyO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHlQb3NNaW4gPSAwO1xuICAgICAgICBpZiAoY29sdW1uLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHZhciBib3R0b21Ob2RlID0gY29sdW1uW2NvbHVtbi5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgIHlQb3NNaW4gPSBib3R0b21Ob2RlLnBvc2l0aW9uKCkueSArIGJvdHRvbU5vZGUuZ2V0U2l6ZSgpLmhlaWdodCArIFJPV19PRkZTRVQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNDcm9zc05vZGUgfHwgeVBvc01pbiA8PSB5UG9zUmVhbHRpdmVUb0NoaWxkcmVuKSB7XG4gICAgICAgICAgICB5UG9zaXRpb24gPSB5UG9zUmVhbHRpdmVUb0NoaWxkcmVuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeVBvc2l0aW9uID0geVBvc01pbjtcbiAgICAgICAgICAgIGlmICghaXNDcm9zc05vZGUpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnRyYW5zbGF0ZUJydW5jaChmaWx0ZXJlZENoaWxkcmVuLCAwLCB5UG9zTWluIC0geVBvc1JlYWx0aXZlVG9DaGlsZHJlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIHJvb3ROb2RlLnBvc2l0aW9uKHhQb3NpdGlvbiwgeVBvc2l0aW9uKTtcblxuICAgICAgICBpZiAoIWlzQ3Jvc3NOb2RlKSB7XG4gICAgICAgICAgICBjb2x1bW4ucHVzaChyb290Tm9kZSk7XG4gICAgICAgIH0gXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2dldEFsbEN1c3RvbVBvc2l0aW9uTm9kZXNPZlRoZVJvb3ROb2RlIChyb290Tm9kZSkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSByb290Tm9kZS5nZXRWaXNpYmxlQ2hpbGRyZW4oKTtcbiAgICAgICAgdmFyIGN1c3RvbUNoaWxkcmVuID0gY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kZS5nZXQoJ2N1c3RvbVBvc2l0aW9uJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBjaGlsZHJlbi5mb3JFYWNoKGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICBjdXN0b21DaGlsZHJlbiA9IGN1c3RvbUNoaWxkcmVuLmNvbmNhdChfZ2V0QWxsQ3VzdG9tUG9zaXRpb25Ob2Rlc09mVGhlUm9vdE5vZGUobikpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGN1c3RvbUNoaWxkcmVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoZWNrcyB3aGV0aGVyIHRoZSBub2RlIGlzIG92ZXJsYXBwZWQgd2l0aCBzb21lIG9mIHRoZSBuZWlnYm91cnMgaW4gdGhlIGNvbHVtbi5cbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAgICAgKiBAcGFyYW0ge0FycmF5IG9mIE5vZGV9IGNvbHVtblxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9oaXRUZXN0V2l0aE5laWdib3VycyAobm9kZSwgY29sdW1uKSB7XG4gICAgICAgIHZhciBpbmRleCA9IGNvbHVtbi5pbmRleE9mKG5vZGUpO1xuICAgICAgICBpZiAoaW5kZXggPT09IC0xKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBfaGl0VGVzdCAobm9kZSwgY29sdW1uW2luZGV4IC0gMV0pIHx8IF9oaXRUZXN0IChub2RlLCBjb2x1bW5baW5kZXggKyAxXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHdoZXRoZXIgdGhlIG5vZGUgbnVtYmVyIG9uZSBhbmQgdGhlIG51bWJlciB0d28gYXJlIG92ZXJsYXBwZWQuXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlMVxuICAgICAqIEBwYXJhbSB7Tm9kZX0gbm9kZTJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaGl0VGVzdCAobm9kZTEsIG5vZGUyKSB7XG4gICAgICAgIGlmICghbm9kZTEgfHwgIW5vZGUyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHZhciBiQm94ID0gbnVsbDtcbiAgICAgICAgdmFyIHRlc3RlZE5vZGUgPSBudWxsO1xuXG4gICAgICAgIGlmIChub2RlMS5nZXRTaXplKCkuaGVpZ2h0ID4gbm9kZTIuZ2V0U2l6ZSgpLmhlaWdodCkge1xuICAgICAgICAgICAgYkJveCA9IG5vZGUxLmdldEJCb3goKTtcbiAgICAgICAgICAgIHRlc3RlZE5vZGUgPSBub2RlMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJCb3ggPSBub2RlMi5nZXRCQm94KCk7XG4gICAgICAgICAgICB0ZXN0ZWROb2RlID0gbm9kZTE7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHAgPSB0ZXN0ZWROb2RlLnBvc2l0aW9uKCk7XG4gICAgICAgIHZhciBzaXplID0gdGVzdGVkTm9kZS5nZXRTaXplKCk7XG4gICAgICAgIHZhciB4Q2VudGVyID0gcC54ICsgc2l6ZS53aWR0aCAvIDI7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBiQm94LmNvbnRhaW5zUG9pbnQoe3g6IHhDZW50ZXIsIHk6IHAueX0pIHx8XG4gICAgICAgICAgICBiQm94LmNvbnRhaW5zUG9pbnQoe3g6IHhDZW50ZXIsIHk6IHAueSArIHNpemUuaGVpZ2h0fSkgfHxcbiAgICAgICAgICAgIGJCb3guY29udGFpbnNQb2ludCh7eDogeENlbnRlciwgeTogcC55IC0gUk9XX09GRlNFVH0pIHx8XG4gICAgICAgICAgICBiQm94LmNvbnRhaW5zUG9pbnQoe3g6IHhDZW50ZXIsIHk6IHAueSArIFJPV19PRkZTRVR9KVxuICAgICAgICApO1xuICAgIH1cbn1cbm1vZHVsZS5leHBvcnRzID0gTGF5b3V0UG9zaXRpb25NYW5hZ2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgTmVpZ2hib3JHcmFtID0gcmVxdWlyZSgnLi9uZWlnaGJvckdyYW0nKTtcbnZhciBEYXRhUHJvdmlkZXIgPSByZXF1aXJlKCcuL2RhdGFQcm92aWRlcicpO1xuXG52YXIgSW5mb1BhbmVsID0gcmVxdWlyZSgnLi9odG1sVUkvaW5mb1BhbmVsJyk7XG52YXIgT3B0aW9uc1BhbmVsID0gcmVxdWlyZSgnLi9odG1sVUkvb3B0aW9uc1BhbmVsJyk7XG52YXIgRGVmYXVsdFVJID0gcmVxdWlyZSgnLi9odG1sVUkvZGVmYXVsdFVJJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGdldERlZmF1bHRQcm9wZXJ0aWVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBERUZBVUxUX1BBR0VfU0laRTogICAgICA1LCAgIC8vIEl0J3MgZm9yIHBhZ2luYXRpb25cbiAgICAgICAgICAgIENPTE9SX0NMQVNTX0NPVU5UOiAgICAgIDEwLFxuICAgICAgICAgICAgQ09MX09GRlNFVDogICAgICAgICAgICAgMTAwLCAvLyBJdCB1c2VkIHRvIGNhbGN1bGF0ZSBkaXN0YW5jZSBiZXR3ZWVuIGNvbHVtbnMgaW4gdGhlIGdyYXBoXG4gICAgICAgICAgICBST1dfT0ZGU0VUOiAgICAgICAgICAgICAzMCwgIC8vIEl0IHVzZWQgdG8gY2FsY3VsYXRlIGRpc3RhbmNlIGJldHdlZW4gcm93cyBpbiB0aGUgZ3JhcGhcbiAgICAgICAgICAgIENST1NTX05PREVfT0ZGU0VUOiAgICAgIDMwLCAgLy8gSXQgZGVmaW5lIG9mZnNldCBvZiB0aGUgY3Jvc3Mgbm9kZSByZWxhdGl2ZSB0byB0aGUgbmV4dCBjb2x1bW4gcG9zaXRpb25cbiAgICAgICAgICAgIEVMRU1FTlRfV0lEVEg6ICAgICAgICAgIDEzMCxcbiAgICAgICAgICAgIEVMRU1FTlRfSEVJR0hUOiAgICAgICAgIDMwLFxuICAgICAgICAgICAgVFJBTlNJVElWRV9FWFBBTlNJT05fTElNSVRfU1RFUDogMTAsIC8vIEl0IHNheXMgaG93IG11Y2ggbm9kZXMgd2lsbCBiZSBleHBhbmRlZCB0cmFuc2l0aXZlbHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBiZWZvcmUgdGhlIHF1ZXN0aW9uICdEbyB5b3Ugd2FudCB0byBjb250aW51ZT8nXG4gICAgICAgICAgICBGVUxMX05PREVfTEFCRUxTOiBmYWxzZSwgICAgICAgICAgICAgLy8gVGVsbHMgd2hldGhlciBvciBub3Qgc2hvdWxkIHdlIGV4cGFuZCBub2RlIGxhYmVsc1xuICAgICAgICAgICAgQ09MT1JfQ0xBU1NfTUFQOiB7XG4gICAgICAgICAgICAgICAgJ3N1YkNsYXNzT2YnOiAnY29sb3ItY2xhc3Mtc3ViLWNsYXNzLW9mJyxcbiAgICAgICAgICAgICAgICAndHlwZSc6ICdjb2xvci1jbGFzcy10eXBlJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0sXG5cbiAgICBjcmVhdGU6IGZ1bmN0aW9uIChlbCwgZGF0YVByb3ZpZGVyLCBmb2N1c05vZGVJZCwgcmVzb3VyY2VQYXRoLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBuZXcgTmVpZ2hib3JHcmFtKFxuICAgICAgICAgICAgZGF0YVByb3ZpZGVyLCBcbiAgICAgICAgICAgIHtlbDogZWx9LCAvLyBwYXBlciBwcm9wZXJ0aWVzXG4gICAgICAgICAgICBmb2N1c05vZGVJZCxcbiAgICAgICAgICAgIHJlc291cmNlUGF0aCxcbiAgICAgICAgICAgIG9wdGlvbnNcbiAgICAgICAgKTtcbiAgICB9LFxuICAgIFxuICAgIGdldERlZmF1bHREYXRhUHJvdmlkZXI6IGZ1bmN0aW9uIChzZXJ2ZXJVcmwsIGJhc2UsIHZpZXdDbGFzcykge1xuICAgICAgICByZXR1cm4gbmV3IERhdGFQcm92aWRlcihzZXJ2ZXJVcmwsIGJhc2UsIHZpZXdDbGFzcyk7XG4gICAgfSxcblxuICAgIHVpVXRpbHM6IHtcbiAgICAgICAgRGVmYXVsdFVJOiBEZWZhdWx0VUksXG4gICAgICAgIEluZm9QYW5lbDogSW5mb1BhbmVsLFxuICAgICAgICBPcHRpb25zUGFuZWw6IE9wdGlvbnNQYW5lbCxcbiAgICB9LFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNsb25lRGVlcCA9IHJlcXVpcmUoJ2xvZGFzaCcpLmNsb25lRGVlcDtcbnZhciBqb2ludCA9IHJlcXVpcmUoJ3JhcHBpZCcpO1xudmFyIFRRR3JhbVVJID0gcmVxdWlyZSgndmlzdWFsaXphdGlvbnMtbGlicmFyeScpO1xudmFyIEdyYXBoTGF5b3V0ID0gcmVxdWlyZSgnLi9ncmFwaExheW91dCcpO1xudmFyIFN0YXRlU3RvcmFnZSA9IHJlcXVpcmUoJy4vc3RhdGVTdG9yYWdlJyk7XG52YXIgUG9wVXBNZW51ID0gcmVxdWlyZSgnLi9wb3BVcE1lbnUnKTtcbi8vIHZhciBBcnJheUJ1ZmZlciA9IHJlcXVpcmUoJ3R5cGVkYXJyYXknKS5BcnJheUJ1ZmZlcjtcbi8vIHZhciBVaW50OEFycmF5ID0gcmVxdWlyZSgndHlwZWRhcnJheScpLlVpbnQ4QXJyYXk7XG52YXIgZ3JhcGhFbGVtZW50cyA9IHJlcXVpcmUoJy4vZ3JhcGhFbGVtZW50cycpO1xudmFyIHNhdmVBcyA9IHJlcXVpcmUoJ2ZpbGUtc2F2ZXJqcycpO1xuXG52YXIgTm9kZSA9IGdyYXBoRWxlbWVudHMuTm9kZTtcbnZhciBFZGdlID0gZ3JhcGhFbGVtZW50cy5FZGdlO1xudmFyIENyb3NzTm9kZSA9IGdyYXBoRWxlbWVudHMuQ3Jvc3NOb2RlO1xuXG4vKipcbiAqIE5laWdoYm9yR3JhbS5cbiAqIENvbnRhaW4gZ3JhcGggbGF5b3V0IGFuZCBtYW5hZ2UgYWxsIGRhdGEuXG4gKlxuICogQ29uc3RydWN0b3IgcGFyYW1ldGVyczpcbiAqICAgICAgZGF0YVByb3ZpZGVyOiBEYXRhUHJvdmlkZXJcbiAqICAgICAgcGFwZXJQcm9wZXJ0aWVzOiB7am9pbnRqcyBncmFwaCBwcm9wZXJ0aWVzfVxuICogICAgICBmb2N1c05vZGVJZDogc3RyaW5nXG4gKiAgICAgIHJlc291cmNlUGF0aDogc3RyaW5nXG4gKiAgICAgIF9vcHRpb25zOiB7XG4gKiAgICAgICAgICBERUZBVUxUX1BBR0VfU0laRTogbnVtYmVyLCBcbiAqICAgICAgICAgIENPTE9SX0NMQVNTX0NPVU5UOiBudW1iZXIsIFxuICogICAgICAgICAgTUFYX0xBQkVMX0xFTkdUSDogbnVtYmVyLCBcbiAqICAgICAgICAgIEVMRU1FTlRfV0lEVEg6IG51bWJlcjtcbiAqICAgICAgICAgIEVMRU1FTlRfSEVJR0hUOiBudW1iZXI7XG4gKiAgICAgICAgICBDT0xfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgUk9XX09GRlNFVDogbnVtYmVyLCBcbiAqICAgICAgICAgIENST1NTX05PREVfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ09MT1JfQ0xBU1NfTUFQOiB7XG4gKiAgICAgICAgICAgICAgJ3N1YkNsYXNzT2YnOiBzdHJpbmcsIFxuICogICAgICAgICAgICAgICd0eXBlJzogc3RyaW5nXG4gKiAgICAgICAgICB9XG4gKiAgICAgIH1cbiAqXG4gKiBQdWJsaWMgbWV0aG9kczpcbiAqICAgICAgc2V0Rm9jdXNOb2RlKGZvY3VzTm9kZUlkOiBzdHJpbmcpOiB2b2lkXG4gKiAgICAgIG9uTm9kZVNlbGVjdGVkKGNhbGxiYWNrOiBmdW5jdGlvbik6IHZvaWRcbiAqICAgICAgb25Ob2RlRm9jdXNlZChjYWxsYmFjazogZnVuY3Rpb24pOiB2b2lkXG4gKiAgICAgIGNsZWFuKCk6IHZvaWRcbiAqICAgICAgZ2V0Tm9kZXMoKTogTm9kZVtdXG4gKiAgICAgIGdldEVkZ2VzKCk6IEVkZ2VbXVxuICogICAgICBnZXRTdGF0ZXNIaXN0b3J5KCk6IHtcbiAqICAgICAgICAgIHN0YXRlczogW10sXG4gKiAgICAgICAgICBjdXJyZW50SW5kZXg6IG51bWJlcixcbiAqICAgICAgfVxuICogICAgICByZWZyZXNoTGF5b3V0KCk6IHZvaWRcbiAqICAgICAgY2VudGVyKHg6IG51bWJlciwgeTogbnVtYmVyLCBvcHQ6IG9wdCk6IHZvaWRcbiAqICAgICAgem9vbShzY2FsZTogbnVtYmVyLCBvcHQ6IG9wdCk6IHZvaWRcbiAqICAgICAgdW5kb1N0YXRlKCk6IHZvaWQgLSByZXR1cm5zIHRvIHN0YXRlIHdpdGggcHJldmlvdXMgZm9jdXNOb2RlXG4gKiAgICAgIHJlZG9TdGF0ZSgpOiBib2lkIC0gcmV0dXJucyB0byBzdGF0ZSB3aXRoIG5leHQocHJldmlvdXMgYmVmb3JlIHVuZG8pIGZvY3VzTm9kZVxuICovXG5mdW5jdGlvbiBOZWlnaGJvckdyYW0gKGRhdGFQcm92aWRlciwgcGFwZXJQcm9wZXJ0aWVzLCBmb2N1c05vZGVJZCwgcmVzb3VyY2VQYXRoLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLyoqXG4gICAgICogUHJpdmF0ZSBmaWxkc1xuICAgICAqL1xuICAgIHZhciBfcGFwZXIgPSBudWxsO1xuICAgIHZhciBfb3B0aW9ucyA9IGNsb25lRGVlcChvcHRpb25zKTtcbiAgICB2YXIgX2xheW91dCA9IG51bGw7XG4gICAgdmFyIF9vbk5vZGVGb2N1c2VkQ2FsbEJhY2sgPSBudWxsO1xuICAgIHZhciBfb25TdGF0ZUNoYW5nZWRDYWxsQmFjayA9IG51bGw7XG4gICAgdmFyIF9ncmFwaCA9IG51bGw7XG4gICAgdmFyIF9wYXBlclNjcm9sbGVyID0gbnVsbDtcbiAgICB2YXIgX2VsID0gbnVsbDtcbiAgICB2YXIgX3N0YXRlU3RvcmFnZSA9IG51bGw7XG4gICAgdmFyIF91aUxheWVyID0gbnVsbDtcbiAgICB2YXIgX3BvcFVwTWVudSA9IG51bGw7XG4gICAgdmFyIF9hc3lua09wZXJhdGlvbiA9IGZhbHNlO1xuICAgIHZhciBfZGF0YUNhY2hlID0ge307XG4gICAgdmFyIF90cmFuc2l0aXZlQ29yZSA9IG5ldyBUcmFuc2l0aXZlQ29yZShzZWxmKTtcbiAgICB2YXIgX2Z1bGxOb2RlTGFiZWxzID0gX29wdGlvbnMuRlVMTF9OT0RFX0xBQkVMUztcbiAgICB2YXIgX3Byb2dyZXNzU2NyZWVuID0gbnVsbDtcblxuXG4gICAgLyoqXG4gICAgICogUHJpdmF0ZSBmdW5jdGlvbiB3aGljaCB1c2VkIGFzIGNvbnN0cnVjdG9yXG4gICAgICogQHBhcmFtICB7RGF0YVByb3ZpZGVyfSBkYXRhUHJvdmlkZXIgLSBPYmplY3Qgd2hpY2ggcHJvdmlkZSBkYXRhIGZvciBncmFwaFxuICAgICAqIEBwYXJhbSAge09iamVjdH0gcGFwZXJQcm9wZXJ0aWVzIC0gUHJvcGVydGllcyBmb3Igam9pbnQuZGlhLlBhcGVyXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBmb2N1c05vZGVJZCAtIElkIHdoaWNoIHVzZWQgdG8gc2V0IGZvY3VzIG5vZGVcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IHJlc291cmNlUGF0aCAtIFBhdGggdG8gaWNvbiByZXNvdXJjZXMsIHVzZWQgZm9yIHJ1bnRpbWUgVVJMc1xuICAgICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIG9wdGlvbnMgZm9yIHRoZSBhcHBsaWNhdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9pbml0aWFsaXplIChkYXRhUHJvdmlkZXIsIHBhcGVyUHJvcGVydGllcywgZm9jdXNOb2RlSWQsIHJlc291cmNlUGF0aCwgb3B0aW9ucykge1xuICAgICAgICBzZWxmLnJlc291cmNlUGF0aCA9IHJlc291cmNlUGF0aDtcbiAgICAgICAgc2VsZi5kYXRhUHJvdmlkZXIgPSBkYXRhUHJvdmlkZXI7XG4gICAgICAgIF9ncmFwaCA9IHBhcGVyUHJvcGVydGllcy5ncmFwaCA/IHBhcGVyUHJvcGVydGllcy5ncmFwaCA6IG5ldyBqb2ludC5kaWEuR3JhcGgoKTtcblxuICAgICAgICB2YXIgZGVmYXVsdFByb3AgPSB7XG4gICAgICAgICAgICBlbDogJ2dyYXBoUGxhY2UnLFxuICAgICAgICAgICAgbW9kZWw6IF9ncmFwaCxcbiAgICAgICAgICAgIGdyaWRTaXplOiAxLFxuICAgICAgICAgICAgd2lkdGg6ICc1MDAwJyxcbiAgICAgICAgICAgIGhlaWdodDogJzUwMDAnLFxuICAgICAgICAgICAgYXN5bmM6IHRydWVcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIHZhciBwcm9wZXJ0aWVzID0gX2V4dGVuZFByb3BlcnRpZXMoZGVmYXVsdFByb3AsIHBhcGVyUHJvcGVydGllcyk7XG4gICAgICAgIHZhciBlbElkID0gcHJvcGVydGllcy5lbDtcbiAgICAgICAgcHJvcGVydGllcy5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgX3BhcGVyID0gbmV3IGpvaW50LmRpYS5QYXBlcihwcm9wZXJ0aWVzKTtcblxuICAgICAgICBfcGFwZXJTY3JvbGxlciA9IG5ldyBqb2ludC51aS5QYXBlclNjcm9sbGVyKHtcbiAgICAgICAgICAgIHBhcGVyOiBfcGFwZXJcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGNvbW1hbmRNYW5hZ2VyID0gbmV3IGpvaW50LmRpYS5Db21tYW5kTWFuYWdlcih7Z3JhcGg6IF9ncmFwaH0pO1xuICAgICAgICB2YXIgdmFsaWRhdG9yID0gbmV3IGpvaW50LmRpYS5WYWxpZGF0b3Ioe2NvbW1hbmRNYW5hZ2VyOiBjb21tYW5kTWFuYWdlcn0pO1xuICAgICAgICB2YWxpZGF0b3IudmFsaWRhdGUoJ2NoYW5nZTpwb3NpdGlvbicsIF92YWxpZGF0ZVBvc2l0aW9uKTtcbiAgICAgICAgdmFsaWRhdG9yLm9uKCdpbnZhbGlkJywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgIF9sYXlvdXQuZ2V0Tm9kZXMoKS5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5iYWRQb3NpdGlvbihmYWxzZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgX3BhcGVyLm9uKCdjZWxsOm1vdXNld2hlZWwnLCBmdW5jdGlvbiAoY2VsbCwgZXZ0LCB4LCB5LCBkZWx0YSkge1xuICAgICAgICAgICAgb25XaGVlbFNjcm9sbCAoZXZ0LCB4LCB5LCBkZWx0YSk7XG4gICAgICAgIH0pO1xuICAgICAgICBfcGFwZXIub24oJ2JsYW5rOm1vdXNld2hlZWwnLCBmdW5jdGlvbiAoZXZ0LCB4LCB5LCBkZWx0YSkge1xuICAgICAgICAgICAgb25XaGVlbFNjcm9sbCAoZXZ0LCB4LCB5LCBkZWx0YSk7XG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgdmFyIHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChlbElkKTtcbiAgICAgICAgcm9vdC5pbm5lckhUTUwgPSAnJztcbiAgICAgICAgX2VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnRElWJyk7XG4gICAgICAgIHJvb3QuYXBwZW5kQ2hpbGQoX2VsKTtcblxuICAgICAgICBfZWwuY2xhc3NOYW1lID0gJ3RxLW5nLXJvb3QnO1xuICAgICAgICBfZWwuYXBwZW5kQ2hpbGQoX3BhcGVyU2Nyb2xsZXIucmVuZGVyKCkuZWwpO1xuICAgICAgICBfY29uZmlndXJhdGVQYXBlckxpc3RlbmVycygpO1xuXG4gICAgICAgIF9wcm9ncmVzc1NjcmVlbiA9IG5ldyBUUUdyYW1VSS5Qcm9ncmVzc1NjcmVlbih7XG4gICAgICAgICAgICBiYXNlRWxlbWVudDogX2VsLFxuICAgICAgICB9KTtcbiAgICBcblxuICAgICAgICBfbGF5b3V0ID0gbmV3IEdyYXBoTGF5b3V0KF9ncmFwaCwgX3BhcGVyLCBfcGFwZXJTY3JvbGxlciwgb3B0aW9ucyk7XG4gICAgICAgIF9zdGF0ZVN0b3JhZ2UgPSBuZXcgU3RhdGVTdG9yYWdlKF9sYXlvdXQsIG9wdGlvbnMpO1xuXG4gICAgICAgIF9vbk5vZGVGb2N1c2VkQ2FsbEJhY2sgPSBbXTtcblxuICAgICAgICBfb25TdGF0ZUNoYW5nZWRDYWxsQmFjayA9IFtdO1xuXG4gICAgICAgIGlmIChmb2N1c05vZGVJZCkgc2VsZi5zZXRGb2N1c05vZGUoZm9jdXNOb2RlSWQpO1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uV2hlZWxTY3JvbGwgKGV2dCwgeCwgeSwgZGVsdGEpIHtcbiAgICAgICAgICAgIGlmIChldnQuY3RybEtleSkge1xuICAgICAgICAgICAgICAgIGlmIChkZWx0YSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi56b29tKDAuMiwgeyBtYXg6IDQgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi56b29tKC0wLjIsIHsgbWluOiAwLjIgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChfcG9wVXBNZW51KSBfcG9wVXBNZW51LnJlZnJlc2goKTtcbiAgICAgICAgICAgICAgICBldnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIF91aUxheWVyID0gX2NyZWF0ZVVJTGF5ZXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB1c2VkIHRvIGNsZWFuIGdyYXBoIChSZW1vdmUgYWxsIG5vZGVzIGFuZCBlZGdlcyBmcm9tIGxheW91dCkuXG4gICAgICovXG4gICAgc2VsZi5jbGVhbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX2xheW91dC5jbGVhbkxheW91dCgpO1xuICAgIH07XG5cbiAgICBzZWxmLmZ1bGxOb2RlTGFiZWxzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBfZnVsbE5vZGVMYWJlbHMgPSB2YWx1ZTtcbiAgICAgICAgICAgIHZhciBub2RlcyA9IF9sYXlvdXQuZ2V0Tm9kZXMoKTtcbiAgICAgICAgICAgIG5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldCgnZnVsbExhYmVsJywgX2Z1bGxOb2RlTGFiZWxzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfZnVsbE5vZGVMYWJlbHM7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZ1bmN0aW9uIGRvIHJlcXVlc3QgZGF0YSB0aHJvdWdoIGRhdGEgcHJvdmlkZXIgYW5kIHNldCBuZXcgbm9kZSBhcyBmb2N1c2VkLlxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gZm9jdXNOb2RlSWQgLSBJZCBvZiBmb2N1cyBub2RlXG4gICAgICovXG4gICAgc2VsZi5zZXRGb2N1c05vZGUgPSBmdW5jdGlvbiAoZm9jdXNOb2RlSWQpIHtcbiAgICAgICAgX2xvYWRpbmdJbmRpY2F0aW9uICgnZmV0Y2hpbmcnKTtcbiAgICAgICAgX2FzeW5rT3BlcmF0aW9uID0gdHJ1ZTtcbiAgICAgICAgX3JlcXVlc3REYXRhKGZvY3VzTm9kZUlkLFxuICAgICAgICAgICAgZnVuY3Rpb24gKHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIF9hc3lua09wZXJhdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIF9sb2FkaW5nSW5kaWNhdGlvbiAoJ3JlbmRlcmluZycpO1xuICAgICAgICAgICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbiAoKSB7IC8vIGl0J3MgbmVjZXNzYXJ5IHRvIG1ha2UgYWJsZSBqcyBjaGFuZ2UgbG9hZGluZyB0aXRsZS5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGluZGV4ID0gcmVzdWx0Lm5vZGVzLm1hcChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5vZGUuaWQ7XG4gICAgICAgICAgICAgICAgICAgIH0pLmluZGV4T2YoZm9jdXNOb2RlSWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggIT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfbGF5b3V0LmdldFJvb3ROb2RlKCkpIF9zdGF0ZVN0b3JhZ2UucHVzaFN0YXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY2xlYW4oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZW50cmFsTm9kZSA9IF9zZXRDZW50cmFsTm9kZShyZXN1bHQubm9kZXNbaW5kZXhdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5ub2Rlcy5zcGxpY2UoaW5kZXgsIDEpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBfZXhwYW5kTm9kZShjZW50cmFsTm9kZS5pZCwgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVmcmVzaExheW91dCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX29uTm9kZUZvY3VzZWRDYWxsQmFjay5mb3JFYWNoKGZ1bmN0aW9uIChjYWxsQmFjaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxCYWNrKGNlbnRyYWxOb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgX2xvYWRpbmdJbmRpY2F0aW9uICgnY29tcGxldGVkJyk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfbG9hZGluZ0luZGljYXRpb24gKCdjb21wbGV0ZWQnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgICAgICAgICAgX2xvYWRpbmdJbmRpY2F0aW9uICgnZXJyb3InKTtcbiAgICAgICAgICAgICAgICBfYXN5bmtPcGVyYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBfbG9hZGluZ0luZGljYXRpb24gKCdjb21wbGV0ZWQnKTtcbiAgICAgICAgICAgICAgICBuZXcgam9pbnQudWkuRGlhbG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDMwMCxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdBbGVydCcsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRnVuY3Rpb24gd2hpY2ggbmVlZGVkIHRvIHNldCBoYW5kbGVyIG9uICdOb2RlIHNlbGVjdGVkJyBldmVudC5cbiAgICAgKiBAcGFyYW0gIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBIYW5kbGVyXG4gICAgICovXG4gICAgc2VsZi5vbk5vZGVTZWxlY3RlZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBfcGFwZXIub24oJ2NlbGw6cG9pbnRlcmRvd24nLCBmdW5jdGlvbiAoY2VsbCkge1xuICAgICAgICAgICAgaWYgKGNlbGwgJiYgY2VsbC5tb2RlbCBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhjZWxsLm1vZGVsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBfcGFwZXIub24oJ2JsYW5rOnBvaW50ZXJkb3duJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB3aGljaCBuZWVkZWQgdG8gc2V0IGhhbmRsZXIgb24gJ05vZGUgZm9jdXNlZCcgZXZlbnQuXG4gICAgICogQHBhcmFtICB7ZnVuY3Rpb259IGNhbGxiYWNrIC0gSGFuZGxlclxuICAgICAqL1xuICAgIHNlbGYub25Ob2RlRm9jdXNlZCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBfb25Ob2RlRm9jdXNlZENhbGxCYWNrLnB1c2goY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB3aGljaCBuZWVkZWQgdG8gc2V0IGhhbmRsZXIgb24gJ1N0YXRlIGNoYW5nZWQnIGV2ZW50LlxuICAgICAqIEBwYXJhbSAge2Z1bmN0aW9ufSBjYWxsYmFjayAtIEhhbmRsZXJcbiAgICAgKi9cbiAgICBzZWxmLm9uU3RhdGVDaGFuZ2VkID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgIF9vblN0YXRlQ2hhbmdlZENhbGxCYWNrLnB1c2goY2FsbGJhY2spO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gYWxsIG5vZGVzIG9mIHRoZSBncmFwaC5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IE5vZGVzIG9mIHRoZSBncmFwaFxuICAgICAqL1xuICAgIHNlbGYuZ2V0Tm9kZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfbGF5b3V0LmdldE5vZGVzKCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJldHVybiBhbGwgZWRnZXMgb2YgdGhlIGdyYXBoLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gRWRnZXMgb2YgdGhlIGdyYXBoXG4gICAgICovXG4gICAgc2VsZi5nZXRFZGdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF9sYXlvdXQuZ2V0RWRnZXMoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmVjYWxjdWxhdGVzIHRoZSBsYXlvdXRcbiAgICAgKi9cbiAgICBzZWxmLnJlZnJlc2hMYXlvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIF9sYXlvdXQucmVjYWxjdWxhdGVMYXlvdXQoKTtcbiAgICAgICAgc2VsZi5jZW50ZXIoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ2VudGVycyBwYXBlclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gY29vcmRpbmF0ZSBvZiB0aGUgY2VudGVyIG9uIHggYXhpc1xuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gY29vcmRpbmF0ZSBvZiB0aGUgY2VudGVyIG9uIHkgYXhpc1xuICAgICAqIEBwYXJhbSB7b3B0fSBvcHQgLSAob3B0aW9uYWwpIG9wdGlvbnMgb2YgcGFwZXJTY3JvbGxlclxuICAgICAqL1xuICAgIHNlbGYuY2VudGVyID0gZnVuY3Rpb24gKHgsIHksIG9wdCkge1xuICAgICAgICBpZiAoeCAmJiB5KSBfcGFwZXJTY3JvbGxlci5jZW50ZXIoeCwgeSwgb3B0KTtcbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB2YXIgcm9vdCA9IF9sYXlvdXQuZ2V0Um9vdE5vZGUoKTtcbiAgICAgICAgICAgIF9wYXBlclNjcm9sbGVyLmNlbnRlcihcbiAgICAgICAgICAgICAgICByb290LnBvc2l0aW9uKCkueCArIHJvb3QuZ2V0U2l6ZSgpLndpZHRoIC8gMixcbiAgICAgICAgICAgICAgICByb290LnBvc2l0aW9uKCkueSArIHJvb3QuZ2V0U2l6ZSgpLmhlaWdodCAvIDIsXG4gICAgICAgICAgICAgICAgb3B0XG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEl0IGNlbnRlcnMgcGFwZXJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2NhbGUgLSBvZmZzZXQgdmFsdWVzIG9mIHNjYWxlXG4gICAgICogQHBhcmFtIHtvcHR9IG9wdCAtIChvcHRpb25hbCkgb3B0aW9ucyBvZiBwYXBlclNjcm9sbGVyIHpvb21pbmdcbiAgICAgKi9cbiAgICBzZWxmLnpvb20gPSBmdW5jdGlvbiAoc2NhbGUsIG9wdCkge1xuICAgICAgICBpZiAoIXNjYWxlKSBfcGFwZXJTY3JvbGxlci56b29tVG9GaXQob3B0KTtcbiAgICAgICAgZWxzZSBfcGFwZXJTY3JvbGxlci56b29tKHNjYWxlLCBvcHQpO1xuICAgICAgICBfbGF5b3V0LnJlY2FsY3VsYXRlTGF5b3V0KCk7XG4gICAgICAgIGlmIChfcG9wVXBNZW51KSBfcG9wVXBNZW51LnJlZnJlc2goKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0IHByZXZpb3VzIGZvY3VzZU5vZGUgYXMgY3VyIGZvY3VzTm9kZVxuICAgICAqL1xuICAgIHNlbGYudW5kb1N0YXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3RhdGUgPSBfc3RhdGVTdG9yYWdlLnVuZG9TdGF0ZSgpO1xuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIF9sYXlvdXQubG9hZFN0YXRlKHN0YXRlKTtcbiAgICAgICAgICAgIF9sYXlvdXQucmVjYWxjdWxhdGVMYXlvdXQoKTtcbiAgICAgICAgICAgIF9vblN0YXRlQ2hhbmdlZENhbGxCYWNrLmZvckVhY2goZnVuY3Rpb24gKGNhbGxCYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbEJhY2soc3RhdGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2V0IHByZXZpb3VzIChiZWZvcmUgc2VsZi51bmRvU3RhdGUpIGZvY3VzZU5vZGUgYXMgY3VyIGZvY3VzTm9kZVxuICAgICAqL1xuICAgIHNlbGYucmVkb1N0YXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3RhdGUgPSBfc3RhdGVTdG9yYWdlLnJlZG9TdGF0ZSgpO1xuICAgICAgICBpZiAoc3RhdGUpIHtcbiAgICAgICAgICAgIF9sYXlvdXQubG9hZFN0YXRlKHN0YXRlKTtcbiAgICAgICAgICAgIF9sYXlvdXQucmVjYWxjdWxhdGVMYXlvdXQoKTtcbiAgICAgICAgICAgIF9vblN0YXRlQ2hhbmdlZENhbGxCYWNrLmZvckVhY2goZnVuY3Rpb24gKGNhbGxCYWNrKSB7XG4gICAgICAgICAgICAgICAgY2FsbEJhY2soc3RhdGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIGxpc3Qgb2YgZm9jdXNOb2RlcyBhbmQgY3VycmVudCBpbmRleC5cbiAgICAgKiBAcmV0dXJucyB7XG4gICAgICogIHN0YXRlczogW10sXG4gICAgICogIGN1cnJlbnRJbmRleDogbnVtYmVyLFxuICAgICAqIH1cbiAgICAgKi9cbiAgICBzZWxmLmdldFN0YXRlc0hpc3RvcnkgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVTdG9yYWdlLmdldEhpc3RvcnkoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXhwb3J0cyBncmFwaCB0byBwbmcgb3Igc3ZnIGZpbGVcbiAgICAgKiBAcGFyYW0ge1xuICAgICAqICBuYW1lPzogc3RyaW5nIC0gZmlsZSBuYW1lXG4gICAgICogIHR5cGU/OiBzdHJpbmcgLSAocG5nL3N2ZylcbiAgICAgKiB9IG9wdGlvbnNcbiAgICAqL1xuICAgIHNlbGYuZXhwb3J0ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zKSBvcHRpb25zID0ge307XG4gICAgICAgIHZhciBmaWxlTmFtZSA9IG9wdGlvbnMubmFtZSB8fCAnTmVpZ2hib3JHcmFtX3NuYXBzaG90XycgKyBkYXRlMlN0cmluZyhuZXcgRGF0ZSgpKTtcblxuICAgICAgICBpZiAob3B0aW9ucy50eXBlID09PSAncG5nJykge1xuICAgICAgICAgICAgX3BhcGVyLnRvUE5HKGZ1bmN0aW9uIChpbWFnZSkge1xuICAgICAgICAgICAgICAgIHNhdmVEYXRhKGltYWdlLCBmaWxlTmFtZSwgJ3BuZycpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfcGFwZXIudG9TVkcoZnVuY3Rpb24gKHN2Z1N0cmluZykge1xuICAgICAgICAgICAgICAgIHNhdmVEYXRhKHN2Z1N0cmluZywgZmlsZU5hbWUsICdzdmcnKTtcbiAgICAgICAgICAgIH0se1xuICAgICAgICAgICAgICAgIGNvbnZlcnRJbWFnZXNUb0RhdGFVcmlzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGFyZWE6IF9wYXBlci5nZXRDb250ZW50QkJveCgpLFxuICAgICAgICAgICAgICAgIHByZXNlcnZlRGltZW5zaW9uczogdHJ1ZSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gc2F2ZURhdGEgKGRhdGEsIGZpbGVOYW1lLCB0eXBlKSB7ICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgYmxvYjtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnc3ZnJykge1xuICAgICAgICAgICAgICAgIGJsb2IgPSBuZXcgQmxvYihbZGF0YV0sIHsgdHlwZTogdHlwZSB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3BuZycpIHtcbiAgICAgICAgICAgICAgICBibG9iID0gcG5nMkJsb2IgKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2F2ZUFzKGJsb2IsIGZpbGVOYW1lICsgJy4nICsgdHlwZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgc2VsZi5zZXRTZWxlY3RlZE5vZGUgPSBfc2V0U2VsZWN0ZWROb2RlO1xuXG4gICAgLy9Qcml2YXRlIGZ1bmN0aW9uc1xuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGZ1bmN0aW9uIGRhdGUyU3RyaW5nIChkYXRlKSB7XG4gICAgICAgIHJldHVybiBwYWRTdHIoZGF0ZS5nZXRGdWxsWWVhcigpKSArICdfJyArXG4gICAgICAgICAgICAgICAgcGFkU3RyKDEgKyBkYXRlLmdldE1vbnRoKCkpICsgJ18nICtcbiAgICAgICAgICAgICAgICBwYWRTdHIoZGF0ZS5nZXREYXRlKCkpICsgJ18nICtcbiAgICAgICAgICAgICAgICBwYWRTdHIoZGF0ZS5nZXRIb3VycygpKSArICdfJyArXG4gICAgICAgICAgICAgICAgcGFkU3RyKGRhdGUuZ2V0TWludXRlcygpKSArICdfJyArXG4gICAgICAgICAgICAgICAgcGFkU3RyKGRhdGUuZ2V0U2Vjb25kcygpKTtcblxuICAgICAgICBmdW5jdGlvbiBwYWRTdHIgKGkpIHtcbiAgICAgICAgICAgIHJldHVybiAoaSA8IDEwKSA/ICcwJyArIGkgOiAnJyArIGk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwbmcyQmxvYiAoZGF0YVVSSSkge1xuICAgICAgICAvLyBjb252ZXJ0IGJhc2U2NCB0byByYXcgYmluYXJ5IGRhdGEgaGVsZCBpbiBhIHN0cmluZ1xuICAgICAgICAvLyBkb2Vzbid0IGhhbmRsZSBVUkxFbmNvZGVkIERhdGFVUklzIC0gc2VlIFNPIGFuc3dlciAjNjg1MDI3NiBmb3IgY29kZSB0aGF0IGRvZXMgdGhpc1xuICAgICAgICB2YXIgYnl0ZVN0cmluZyA9IGF0b2IoZGF0YVVSSS5zcGxpdCgnLCcpWzFdKTtcblxuICAgICAgICAvLyB3cml0ZSB0aGUgYnl0ZXMgb2YgdGhlIHN0cmluZyB0byBhbiBBcnJheUJ1ZmZlclxuICAgICAgICB2YXIgYWIgPSBuZXcgQXJyYXlCdWZmZXIoYnl0ZVN0cmluZy5sZW5ndGgpO1xuICAgICAgICB2YXIgaWEgPSBuZXcgVWludDhBcnJheShhYik7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZVN0cmluZy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWFbaV0gPSBieXRlU3RyaW5nLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3cml0ZSB0aGUgQXJyYXlCdWZmZXIgdG8gYSBibG9iLCBhbmQgeW91J3JlIGRvbmVcbiAgICAgICAgdmFyIGJiID0gbmV3IEJsb2IoW2FiXSwgeyB0eXBlOiAnaW1hZ2UvcG5nJyB9KTtcbiAgICAgICAgcmV0dXJuIGJiO1xuICAgIH1cblxuICAgIC8vIHN0YXRlczogZmV0Y2hpbmcsIHJlbmRlcmluZywgY29tcGxldGVkXG4gICAgZnVuY3Rpb24gX2xvYWRpbmdJbmRpY2F0aW9uIChzdGF0ZSkge1xuICAgICAgICBpZiAoc3RhdGUgPT09ICdmZXRjaGluZycpIHtcbiAgICAgICAgICAgIF9wcm9ncmVzc1NjcmVlbi5zZXRTdGF0ZSgnYWN0aXZlJywgJ0ZldGNoaW5nIGRhdGEnKTtcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gJ3JlbmRlcmluZycpIHtcbiAgICAgICAgICAgIF9wcm9ncmVzc1NjcmVlbi5zZXRTdGF0ZSgnYWN0aXZlJywgJ1JlbmRlcmluZyBncmFwaCcpO1xuICAgICAgICB9IGVsc2UgaWYgKHN0YXRlID09PSAnY29tcGxldGVkJykge1xuICAgICAgICAgICAgX3Byb2dyZXNzU2NyZWVuLnNldFN0YXRlKCdjb21wbGV0ZWQnKTtcbiAgICAgICAgfSBlbHNlIGlmIChzdGF0ZSA9PT0gJ2Vycm9yJykge1xuICAgICAgICAgICAgX3Byb2dyZXNzU2NyZWVuLnNldFN0YXRlKCdlcnJvcicsICdFcnJvciBoYXMgb2NjdXJyZWQhJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY3JlYXRlVUlMYXllciAoKSB7XG4gICAgICAgIHZhciB1aUxheWVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnRElWJyk7XG4gICAgICAgIHVpTGF5ZXIuY2xhc3NOYW1lID0gJ25nLXVpJztcbiAgICAgICAgX2VsLnF1ZXJ5U2VsZWN0b3IoJy5wYXBlci5qb2ludC10aGVtZS1kZWZhdWx0JykuYXBwZW5kQ2hpbGQodWlMYXllcik7XG4gICAgICAgIHJldHVybiB1aUxheWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFZhbGlkYXRlcyBwb3NpdGlvbiBvZiB0aGUgbm9kZSBxLnYuIGpvaW50LmRpYS5WYWxpZGF0b3JcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfdmFsaWRhdGVQb3NpdGlvbiAoZXJyLCBjb21tYW5kLCBuZXh0KSB7XG4gICAgICAgIHZhciBjZWxsID0gY29tbWFuZC5kYXRhLmF0dHJpYnV0ZXMgfHwgX2dyYXBoLmdldENlbGwoY29tbWFuZC5kYXRhLmlkKTtcbiAgICAgICAgaWYgKCFfbGF5b3V0LmJsb2NrVmFsaWRhdGlvbiAmJiBjZWxsICYmICFfY2hlY2tQb3NpdGlvbihjZWxsKSkge1xuICAgICAgICAgICAgcmV0dXJuIG5leHQoJ0Fub3RoZXIgY2VsbCBpbiB0aGUgd2F5IScpO1xuICAgICAgICB9IGVsc2VcbiAgICAgICAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIHBvc2l0aW9uIG9mIHRoZSBub2RlIGFuZCBjaGFuZ2UgY29sb3ItY2xhc3MgaWYgbmVlZGVkXG4gICAgICogQHBhcmFtIHtOb2RlfSBub2RlIC0gY2hlY2tlZCBub2RlXG4gICAgICogQHBhcmFtIHtib29sZWFufSByZWN1cnNpdmVseSAtIGZsYWcgaWYgd2UgbmVlZGVkIGNoZWNrIHJlY3Vyc2l2ZWx5XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NoZWNrUG9zaXRpb24gKG5vZGUsIHJlY3Vyc2l2ZWx5KSB7XG4gICAgICAgIGlmICghKG5vZGUgaW5zdGFuY2VvZiBOb2RlKSkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgdmFyIGhpdFRlc3QgPSBmdW5jdGlvbiAobm9kZTEsIG5vZGUyKSB7XG4gICAgICAgICAgICBpZiAoIW5vZGUxIHx8ICFub2RlMiB8fCBub2RlMSBpbnN0YW5jZW9mIENyb3NzTm9kZSB8fCBub2RlMiBpbnN0YW5jZW9mIENyb3NzTm9kZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgdmFyIGJCb3ggPSBudWxsO1xuICAgICAgICAgICAgdmFyIHRlc3RlZE5vZGUgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAobm9kZTEuZ2V0U2l6ZSgpLmhlaWdodCA+IG5vZGUyLmdldFNpemUoKS5oZWlnaHQpIHtcbiAgICAgICAgICAgICAgICBiQm94ID0gbm9kZTEuZ2V0QkJveCgpO1xuICAgICAgICAgICAgICAgIHRlc3RlZE5vZGUgPSBub2RlMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYkJveCA9IG5vZGUyLmdldEJCb3goKTtcbiAgICAgICAgICAgICAgICB0ZXN0ZWROb2RlID0gbm9kZTE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgcCA9IHRlc3RlZE5vZGUucG9zaXRpb24oKTtcbiAgICAgICAgICAgIHZhciBzaXplID0gdGVzdGVkTm9kZS5nZXRTaXplKCk7XG4gICAgICAgICAgICByZXR1cm4gKGJCb3guY29udGFpbnNQb2ludCh7eDogcC54LCB5OiBwLnl9KSB8fFxuICAgICAgICAgICAgYkJveC5jb250YWluc1BvaW50KHt4OiBwLnggKyBzaXplLndpZHRoLCB5OiBwLnl9KSB8fFxuICAgICAgICAgICAgYkJveC5jb250YWluc1BvaW50KHt4OiBwLngsIHk6IHAueSArIHNpemUuaGVpZ2h0fSkgfHxcbiAgICAgICAgICAgIGJCb3guY29udGFpbnNQb2ludCh7eDogcC54ICsgc2l6ZS53aWR0aCwgeTogcC55ICsgc2l6ZS5oZWlnaHR9KSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IF9ncmFwaC5nZXQoJ2NlbGxzJykuZmlsdGVyKGZ1bmN0aW9uIChjZWxsKSB7XG4gICAgICAgICAgICBpZiAoKGNlbGwgaW5zdGFuY2VvZiBOb2RlIHx8IGNlbGwgaW5zdGFuY2VvZiBDcm9zc05vZGUpICYmXG4gICAgICAgICAgICAgICAgY2VsbC5pZCAhPT0gbm9kZS5pZCAmJlxuICAgICAgICAgICAgICAgIGhpdFRlc3QoY2VsbCwgbm9kZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KS5sZW5ndGggPT0gMDtcblxuICAgICAgICBpZiAocmVjdXJzaXZlbHkpIHtcbiAgICAgICAgICAgIG5vZGUuZ2V0VmlzaWJsZUNoaWxkcmVuKCkuZm9yRWFjaChmdW5jdGlvbiAoY2hpbGQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBfY2hlY2tQb3NpdGlvbihjaGlsZCwgcmVjdXJzaXZlbHkpICYmIHJlc3VsdDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUuYmFkUG9zaXRpb24oIXJlc3VsdCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgbm9kZSBmcm9tIHNlcnZlciBpbnRvIHNpbXBsZSBub2RlIGFuZCBzZXRzIGl0IGFzIHJvb3QgaW50byBsYXlvdXQuXG4gICAgICogQHBhcmFtICB7T2JqZWN0fSBzZXJ2ZXJOb2RlIC0gU2VydmVyIG5vZGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc2V0Q2VudHJhbE5vZGUgKHNlcnZlck5vZGUpIHtcbiAgICAgICAgdmFyIGNlbnRyYWxOb2RlID0gX2NyZWF0ZU5vZGUoc2VydmVyTm9kZSk7XG4gICAgICAgIF9sYXlvdXQuc2V0Um9vdE5vZGUoY2VudHJhbE5vZGUpO1xuICAgICAgICAvLyBfcGFwZXJTY3JvbGxlci5jZW50ZXIoX2xheW91dC5nZXRSb290Tm9kZSgpLnBvc2l0aW9uKCkpO1xuICAgICAgICByZXR1cm4gY2VudHJhbE5vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2ltcGxpZmllZCBzZXQgdXAgcGFwZXIuIEVucmljaCBvbGQgcHJvcGVydGllcyBieSBuZXcgb25lLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvbGRQcm9wIC0gT2xkIHByb3BlcnRpZXNcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbmV3UHJvcCAtIE5ldyBwcm9wZXJ0aWVzXG4gICAgICogQHJldHVybnMge09iamVjdH0gRXhzdGVuZGVkIHByb3BlcnRpZXNcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZXh0ZW5kUHJvcGVydGllcyAob2xkUHJvcCwgbmV3UHJvcCkge1xuICAgICAgICB2YXIgZXh0ZW5kZWRPYmplY3QgPSB7fTtcbiAgICAgICAgaWYgKG9sZFByb3ApIHtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG9sZFByb3ApLmZvckVhY2goZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICAgICAgICBleHRlbmRlZE9iamVjdFtwXSA9IG9sZFByb3BbcF07XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobmV3UHJvcCkge1xuICAgICAgICAgICAgT2JqZWN0LmtleXMobmV3UHJvcCkuZm9yRWFjaChmdW5jdGlvbiAocCkge1xuICAgICAgICAgICAgICAgIGV4dGVuZGVkT2JqZWN0W3BdID0gbmV3UHJvcFtwXTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBleHRlbmRlZE9iamVjdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIaWdobGlnaHRzIHRhcmdldCBlbGVtZW50XG4gICAgICovXG4gICAgZnVuY3Rpb24gX3NldFNlbGVjdGVkTm9kZSAoY2VsbCkge1xuICAgICAgICBzZWxmLmdldE5vZGVzKCkuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgbm9kZS5yZW1vdmVIaWdobGlnaHRpbmcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChjZWxsKSB7XG4gICAgICAgICAgICB2YXIgbm9kZTtcbiAgICAgICAgICAgIGlmIChjZWxsLm1vZGVsICYmIGNlbGwubW9kZWwuYWRkSGlnaGxpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IGNlbGwubW9kZWw7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNlbGwuYWRkSGlnaGxpZ2h0aW5nKSB7XG4gICAgICAgICAgICAgICAgbm9kZSA9IGNlbGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW5vZGUuZ2V0KCdoaWRkZW4nKSkge1xuICAgICAgICAgICAgICAgIG5vZGUuYWRkSGlnaGxpZ2h0aW5nKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBwcmV2Tm9kZSA9IG5vZGUuZ2V0UHJldk5vZGUoKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcmV2Tm9kZS5wYWdpbmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHByZXZOb2RlLmdldENoaWxkcmVuKHRydWUpLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkLCBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkID09PSBub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJldk5vZGUucGFnaW5hdGlvbi5mb2N1c09uKGluZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUuYWRkSGlnaGxpZ2h0aW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGV2ZW50IGhhbmRsZXJzXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NvbmZpZ3VyYXRlUGFwZXJMaXN0ZW5lcnMgKCkge1xuICAgICAgICB2YXIgbGFzdFBvc2l0aW9uID0gbnVsbDtcbiAgICAgICAgdmFyIFRIUkVTSE9MRCA9IDE1O1xuICAgICAgICBfcGFwZXIub24oJ2NlbGw6cG9pbnRlcmRvd24nLCBmdW5jdGlvbiAoY2VsbCkge1xuICAgICAgICAgICAgaWYgKGNlbGwgJiYgY2VsbC5tb2RlbCBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxhc3RQb3NpdGlvbikgbGFzdFBvc2l0aW9uID0gY2VsbC5tb2RlbC5wb3NpdGlvbigpO1xuXG4gICAgICAgICAgICAgICAgX3NldFNlbGVjdGVkTm9kZShjZWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgX3BhcGVyLm9uKCdjZWxsOnBvaW50ZXJtb3ZlJywgZnVuY3Rpb24gKGNlbGwpIHtcbiAgICAgICAgICAgIGlmIChjZWxsICYmIGNlbGwubW9kZWwgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgICAgICAgICAgam9pbnQudWkuSGFsby5jbGVhcihfcGFwZXIpO1xuICAgICAgICAgICAgICAgIGlmIChNYXRoLnNxcnQoXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnBvdygobGFzdFBvc2l0aW9uLnggLSBjZWxsLm1vZGVsLnBvc2l0aW9uKCkueCksIDIpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucG93KChsYXN0UG9zaXRpb24ueSAtIGNlbGwubW9kZWwucG9zaXRpb24oKS55KSwgMilcbiAgICAgICAgICAgICAgICAgICAgKSA8IFRIUkVTSE9MRCAmJiAhY2VsbC5tb2RlbC5nZXQoJ2N1c3RvbVBvc2l0aW9uJylcbiAgICAgICAgICAgICAgICApIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGlmICghY2VsbC5tb2RlbC5nZXQoJ2N1c3RvbVBvc2l0aW9uJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2VsbC5tb2RlbC5zZXQoJ2N1c3RvbVBvc2l0aW9uJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIF9sYXlvdXQucmVjYWxjdWxhdGVMYXlvdXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgX2NoZWNrUG9zaXRpb24oY2VsbC5tb2RlbCwgdHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9wYXBlci5vbignY2VsbDpwb2ludGVyZGJsY2xpY2snLCBmdW5jdGlvbiAoY2VsbCkge1xuICAgICAgICAgICAgaWYgKGNlbGwgJiYgY2VsbC5tb2RlbCBpbnN0YW5jZW9mIE5vZGUpIHtcbiAgICAgICAgICAgICAgICBjZWxsLm1vZGVsLnNldCgnZnVsbExhYmVsJywgIWNlbGwubW9kZWwuZ2V0KCdmdWxsTGFiZWwnKSk7XG4gICAgICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBfcGFwZXIub24oJ2NlbGw6cG9pbnRlcnVwJywgZnVuY3Rpb24gKGNlbGwpIHtcbiAgICAgICAgICAgIGlmIChjZWxsICYmIGNlbGwubW9kZWwgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgICAgICAgICAgX2NvbmZpZ3VyYXRlSGFsbyhjZWxsKTtcbiAgICAgICAgICAgICAgICBsYXN0UG9zaXRpb24gPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgX3NldExpbmtQYWdpbmF0aW9uQ29udHJvbHNJbmFjdGl2ZSgpO1xuICAgICAgICAgICAgICAgIF9zZXRMaW5rUGFnaW5hdGlvbkNvbnRyb2xBY3RpdmUoY2VsbC5tb2RlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIF9wYXBlci5vbignYmxhbms6cG9pbnRlcmRvd24nLCBfcGFwZXJTY3JvbGxlci5zdGFydFBhbm5pbmcpO1xuICAgICAgICBfcGFwZXIub24oJ2JsYW5rOnBvaW50ZXJkb3duJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgX3NldFNlbGVjdGVkTm9kZSh1bmRlZmluZWQpO1xuXG4gICAgICAgICAgICBfc2V0TGlua1BhZ2luYXRpb25Db250cm9sc0luYWN0aXZlKCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpZ3VyYXRlcyBoYWxvIGZvciBOb2RlXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNlbGxWaWV3IC0gVmlldyBvZiBub2RlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NvbmZpZ3VyYXRlSGFsbyAoY2VsbFZpZXcpIHtcbiAgICAgICAgaWYgKF9wb3BVcE1lbnUgJiYgX3BvcFVwTWVudS50YXJnZXQgIT09IGNlbGxWaWV3Lm1vZGVsKSB7XG4gICAgICAgICAgICBfcmVtb3ZlUG9wVXAoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBub2RlID0gY2VsbFZpZXcubW9kZWw7XG4gICAgICAgIHZhciBoYWxvID0gbmV3IGpvaW50LnVpLkhhbG8oe1xuICAgICAgICAgICAgZ3JhcGg6IF9ncmFwaCxcbiAgICAgICAgICAgIHBhcGVyOiBfcGFwZXIsXG4gICAgICAgICAgICBjZWxsVmlldzogY2VsbFZpZXcsXG4gICAgICAgICAgICBjbGFzc05hbWU6ICdoYWxvJyArIChub2RlLmlkID09PSBfbGF5b3V0LmdldFJvb3ROb2RlKCkuaWQgPyAnIGhhbG8tb2Ytcm9vdC1ub2RlJyA6ICcnKVxuICAgICAgICB9KTtcbiAgICAgICAgaGFsby5yZW1vdmVIYW5kbGVzKCk7XG5cbiAgICAgICAgaWYgKG5vZGUuZ2V0KCdjdXN0b21Qb3NpdGlvbicpKSB7XG4gICAgICAgICAgICBoYWxvLmFkZEhhbmRsZSh7bmFtZTogJ3Jlc2V0LW5vZGUtcG9zaXRpb24nLCBwb3NpdGlvbjogJ3MnfSk7XG4gICAgICAgICAgICBoYWxvLm9uKCdhY3Rpb246cmVzZXQtbm9kZS1wb3NpdGlvbjpwb2ludGVyZG93bicsIGZ1bmN0aW9uIChldnQpIHtcbiAgICAgICAgICAgICAgICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgX2xheW91dC5kb0ZvckJydW5jaChub2RlLCBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnNldCgnY3VzdG9tUG9zaXRpb24nLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5kYXRhTW9kZWwudHlwZUlkICE9PSAnY3Jvc3NOb2RlJykge1xuICAgICAgICAgICAgdmFyIGNvbmZpZ0J1dHRvbkNsYXNzID0gbm9kZS5nZXREaXJlY3Rpb24oKSA/IFxuICAgICAgICAgICAgICAgICdleHBhbnNpb24tY29uZmlnJyArIChub2RlLmNvbmZpZ3VyYXRpb25TZXQubW9kaWZpZWQgPyAnLW1vZGlmaWVkJyA6ICcnKSA6XG4gICAgICAgICAgICAgICAgJ2V4cGFuc2lvbi1jb25maWcnICsgKG5vZGUuY29uZmlndXJhdGlvblNldC5tb2RpZmllZCA/ICctbW9kaWZpZWQnIDogJycpICsgJy1yZXZlcnNlJztcbiAgICAgICAgICAgIGhhbG8uYWRkSGFuZGxlKHtuYW1lOiBjb25maWdCdXR0b25DbGFzc30pO1xuICAgICAgICAgICAgaGFsby5vbignYWN0aW9uOicgKyBjb25maWdCdXR0b25DbGFzcyArICc6cG9pbnRlcmRvd24nLCBmdW5jdGlvbiAoZXZ0KSB7XG4gICAgICAgICAgICAgICAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIF9vcGVuQ29uZmlnUG9wVXAoY2VsbFZpZXcpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmIChub2RlLmlkICE9PSBfbGF5b3V0LmdldFJvb3ROb2RlKCkuaWQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc2V0Rm9jdXNOb2RlQ2xhc3MgPSBub2RlLmdldERpcmVjdGlvbigpID8gJ3NldC1mb2N1cy1ub2RlJyA6ICdzZXQtZm9jdXMtbm9kZS1yZXZlcnNlJztcbiAgICAgICAgICAgICAgICBoYWxvLmFkZEhhbmRsZSh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHNldEZvY3VzTm9kZUNsYXNzLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGhhbG8ub24oJ2FjdGlvbjonICsgc2V0Rm9jdXNOb2RlQ2xhc3MgKyAnOnBvaW50ZXJkb3duJywgZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoX2FzeW5rT3BlcmF0aW9uKSByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXRGb2N1c05vZGUobm9kZS5kYXRhTW9kZWwudHlwZUlkKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGV4cGFuZENvbGxhcHNlQ2xhc3MgPSBub2RlLmdldERpcmVjdGlvbigpID8gJ2V4cGFuZC1jb2xsYXBzZScgOiAnZXhwYW5kLWNvbGxhcHNlLXJldmVyc2UnO1xuXG4gICAgICAgICAgICBoYWxvLmFkZEhhbmRsZSh7XG4gICAgICAgICAgICAgICAgbmFtZTogKG5vZGUuZGF0YU1vZGVsLmNhbkV4cGFuZCA/IGV4cGFuZENvbGxhcHNlQ2xhc3MgOiBleHBhbmRDb2xsYXBzZUNsYXNzICsgJyBkaXNhYmxlZCcpLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAoIW5vZGUuZ2V0KCdleHBhbmRlZCcpID8gJyBuZy1leHBhbmQnOiAnIG5nLWNvbGxhcHNlJylcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBoYWxvLm9uKFxuICAgICAgICAgICAgICAgICdhY3Rpb246JyArIGV4cGFuZENvbGxhcHNlQ2xhc3MgKyAnOnBvaW50ZXJkb3duJyxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlLmRhdGFNb2RlbC5jYW5FeHBhbmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9vbkV4cGFuZEV2ZW50KGNlbGxWaWV3Lm1vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGhhbG8ubGlzdGVuVG8obm9kZSwgJ2NoYW5nZTpjdXN0b21Qb3NpdGlvbicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBfY29uZmlndXJhdGVIYWxvKGNlbGxWaWV3KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaGFsby5saXN0ZW5Ubyhub2RlLCAnY2hhbmdlOmV4cGFuZGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIF9jb25maWd1cmF0ZUhhbG8oY2VsbFZpZXcpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaGFsby5yZW5kZXIoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfb3BlbkNvbmZpZ1BvcFVwIChjZWxsKSB7XG4gICAgICAgIGlmIChjZWxsICYmIGNlbGwubW9kZWwgaW5zdGFuY2VvZiBOb2RlKSB7XG4gICAgICAgICAgICBpZiAoIV9wb3BVcE1lbnUgfHwgIV9wb3BVcE1lbnUuYWxpdmUpIHtcbiAgICAgICAgICAgICAgICB2YXIgaXNFeHBhbmRlZDtcbiAgICAgICAgICAgICAgICB2YXIgbG9jYWxQb3BVcCA9IF9wb3BVcE1lbnUgPSBuZXcgUG9wVXBNZW51KHtcbiAgICAgICAgICAgICAgICAgICAgYmFzZTogX3VpTGF5ZXIsXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogY2VsbC5tb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgc2Nyb2xsZXI6IF9wYXBlclNjcm9sbGVyLFxuICAgICAgICAgICAgICAgICAgICBiZWZvcmVBcHBseTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaXNFeHBhbmRlZCA9IGNlbGwubW9kZWwuZ2V0KCdleHBhbmRlZCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzRXhwYW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZWxsLm1vZGVsLnNldCgnZXhwYW5kZWQnLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2xheW91dC5jb2xsYXBzZU5vZGUoY2VsbC5tb2RlbC5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGFmdGVyQXBwbHk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9vbkV4cGFuZEV2ZW50KGNlbGwubW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX2NvbmZpZ3VyYXRlSGFsbyhjZWxsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghY2VsbC5tb2RlbC5jb25maWd1cmF0aW9uU2V0LmNvbm5lY3Rpb25zKSB7XG4gICAgICAgICAgICAgICAgICAgIF9yZXF1ZXN0RGF0YShjZWxsLm1vZGVsLnR5cGVJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxQb3BVcCA9PT0gX3BvcFVwTWVudSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfcG9wVXBNZW51LnB1dERhdGEocmVzdWx0LmVkZ2VzIHx8IFtdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgam9pbnQudWkuRGlhbG9nKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDMwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdBbGVydCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfcmVtb3ZlUG9wVXAoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEl0J3MgY2FsbGVkIG9uIGV4cGFuZC1ldmVudC5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY2VsbCAtIFZpZXcgb2YgTm9kZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvcmllbnRhdGlvblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9vbkV4cGFuZEV2ZW50IChub2RlKSB7XG4gICAgICAgIGlmIChfYXN5bmtPcGVyYXRpb24pIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5jb25maWd1cmF0aW9uU2V0ICYmIG5vZGUuY29uZmlndXJhdGlvblNldC5leHBhbmRUcmFuc2l0aXZlbHkpIHtcbiAgICAgICAgICAgIF90cmFuc2l0aXZlQ29yZS5zdGFydChub2RlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICghbm9kZS5nZXQoJ2V4cGFuZGVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxvYWRpbmcgPSBfYWRkTG9hZGluZyhub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgbm9kZS5zZXQoJ2V4cGFuZGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBfc2V0TGlua1BhZ2luYXRpb25Db250cm9sc0luYWN0aXZlKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghX2RhdGFDYWNoZVtub2RlLmlkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2FzeW5rT3BlcmF0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9yZXF1ZXN0RGF0YShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlLnR5cGVJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ2FsbGJhY2ssXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2FzeW5rT3BlcmF0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBqb2ludC51aS5EaWFsb2coe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAzMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ0FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkub3BlbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfcmVtb3ZlTG9hZGluZyhsb2FkaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX3NldExpbmtQYWdpbmF0aW9uQ29udHJvbEFjdGl2ZShub2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NhbGxiYWNrKF9kYXRhQ2FjaGVbbm9kZS5pZF0sIHtmcm9tQ2FjaGU6IHRydWV9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUuc2V0KCdleHBhbmRlZCcsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgX2NvbGxhcHNlTm9kZShub2RlLmlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBzdWNjZXNzQ2FsbGJhY2sgKHJlc3VsdCwgcHJvcHMpIHtcbiAgICAgICAgICAgIF9hc3lua09wZXJhdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgX2V4cGFuZE5vZGUobm9kZSwgcmVzdWx0LCBwcm9wcyAmJiBwcm9wcy5mcm9tQ2FjaGUpO1xuICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICAgICAgX3JlbW92ZUxvYWRpbmcobG9hZGluZyk7XG4gICAgICAgICAgICBfc2V0TGlua1BhZ2luYXRpb25Db250cm9sQWN0aXZlKG5vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlbW92ZVBvcFVwICgpIHtcbiAgICAgICAgX3BvcFVwTWVudS5yZW1vdmUoKTtcbiAgICAgICAgX3BvcFVwTWVudSA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVxdWVzdCBkYXRhIHRocm93IGRhdGEgcHJvdmlkZXIuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGVJZCAtIFR5cGUgaWRcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBzdWNjZXNzQ2FsbGJhY2sgLSBIYW5kbGVyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZXJyb3JDYWxsYmFjayAtIEhhbmRsZXJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcmVxdWVzdERhdGEgKHR5cGVJZCwgc3VjY2Vzc0NhbGxiYWNrLCBlcnJvckNhbGxiYWNrKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzZWxmLmRhdGFQcm92aWRlci5nZXRHcmFwaERhdGEodHlwZUlkLCBzdWNjZXNzQ2FsbGJhY2ssIGVycm9yQ2FsbGJhY2spO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgZXJyb3JDYWxsYmFjay5hcHBseShzZWxmLCBbZXJyb3JdKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3Iuc3RhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSXQgZXhwYW5kcyBub2RlIGJ5IG9idGFpbmVkIGRhdGEuXG4gICAgICogQmluZHMgbmV3IG5vZGVzIGFuZCBlZGdlcyB0byBzb3VyY2Ugbm9kZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZyB8IE5vZGV9IG5vZGUgLSBUeXBlIGlkIG9yIE5vZGVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSAtIERhdGFcbiAgICAgKiBAcGFyYW0ge2Jvb2xlbmF9IGZyb21DYWNoZSAtIGVxdWFscyB0cnVlIGlmIGRhdGEgYXJlIHBhc3NlZCBmcm9tIHRoZSBjYWNoZVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9leHBhbmROb2RlIChub2RlLCBkYXRhLCBmcm9tQ2FjaGUpIHtcbiAgICAgICAgdmFyIGlzTm9kZSA9IHR5cGVvZiBub2RlICE9PSAnc3RyaW5nJztcbiAgICAgICAgdmFyIG5vZGVJZCA9IGlzTm9kZSA/IG5vZGUuaWQgOiBub2RlO1xuXG4gICAgICAgIHZhciBjb25maWcgPSBub2RlLmNvbmZpZ3VyYXRpb25TZXQ7XG4gICAgICAgIHZhciBtYXBGb3JOb2RlRmlsdGVyaW5nID0ge307XG5cbiAgICAgICAgdmFyIHByZXBhcmVkRGF0YTtcbiAgICAgICAgaWYgKCFmcm9tQ2FjaGUpIHtcbiAgICAgICAgICAgIHByZXBhcmVkRGF0YSA9IHtcbiAgICAgICAgICAgICAgICBub2RlczogZGF0YS5ub2RlcyA/IF9wcmVwYXJlTm9kZXMoZGF0YS5ub2RlcykgOiBbXSxcbiAgICAgICAgICAgICAgICBlZGdlczogZGF0YS5lZGdlcyA/IF9wcmVwYXJlRWRnZXMoZGF0YS5lZGdlcykgOiBbXSxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBfZGF0YUNhY2hlW25vZGVJZF0gPSBwcmVwYXJlZERhdGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwcmVwYXJlZERhdGEgPSBkYXRhO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGhlIGRhdGEgZmlsdGVyaW5nXG4gICAgICAgIHZhciBmaWx0ZXJlZERhdGE7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIGZpbHRlcmVkRGF0YSA9IHtcbiAgICAgICAgICAgICAgICBlZGdlczogcHJlcGFyZWREYXRhLmVkZ2VzLmZpbHRlcihmdW5jdGlvbiAoZWRnZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZGlyZWN0aW9uID0gbm9kZS5kYXRhTW9kZWwudHlwZUlkID09PSBlZGdlLmRhdGFNb2RlbC50YXJnZXRUeXBlSWQ7XG4gICAgICAgICAgICAgICAgICAgIHZhciB2ZXJkaWN0ID0gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5maWx0ZXJUeXBlID09PSAnQUxMJyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5maWx0ZXJUeXBlID09PSAnSU5DT01JTkcnICYmIGRpcmVjdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmZpZy5maWx0ZXJUeXBlID09PSAnT1VUR09JTkcnICYmICFkaXJlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgICAgICkgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICghY29uZmlnLmZpbHRlcktleSB8fCBjb25maWcuZmlsdGVyS2V5ICYmIGVkZ2UuZGF0YU1vZGVsLmxhYmVsLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihjb25maWcuZmlsdGVyS2V5LnRvTG93ZXJDYXNlKCkpICE9PSAtMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXJlY3Rpb24gJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25maWcudmlzaWJpbGl0eU1hcFtlZGdlLmRhdGFNb2RlbC50eXBlSWRdID09PSB1bmRlZmluZWQgfHwgY29uZmlnLnZpc2liaWxpdHlNYXBbZWRnZS5kYXRhTW9kZWwudHlwZUlkXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAhZGlyZWN0aW9uICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uZmlnLnZpc2liaWxpdHlNYXBSZXZlcnNlW2VkZ2UuZGF0YU1vZGVsLnR5cGVJZF0gPT09IHVuZGVmaW5lZCB8fCBjb25maWcudmlzaWJpbGl0eU1hcFJldmVyc2VbZWRnZS5kYXRhTW9kZWwudHlwZUlkXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAodmVyZGljdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcEZvck5vZGVGaWx0ZXJpbmdbZWRnZS5kYXRhTW9kZWwuc291cmNlVHlwZUlkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hcEZvck5vZGVGaWx0ZXJpbmdbZWRnZS5kYXRhTW9kZWwudGFyZ2V0VHlwZUlkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdmVyZGljdDtcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBub2RlczogcHJlcGFyZWREYXRhLm5vZGVzLmZpbHRlcihmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbWFwRm9yTm9kZUZpbHRlcmluZ1tub2RlLmRhdGFNb2RlbC50eXBlSWRdO1xuICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbHRlcmVkRGF0YSA9IHByZXBhcmVkRGF0YTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWx0ZXJlZERhdGEubm9kZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgX2xheW91dC5wdXRBbGwoZmlsdGVyZWREYXRhLm5vZGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWx0ZXJlZERhdGEuZWRnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgX2xheW91dC5wdXRBbGwoZmlsdGVyZWREYXRhLmVkZ2VzLCBub2RlSWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZyb21DYWNoZSAmJiBpc05vZGUpIHtcbiAgICAgICAgICAgIG5vZGUuZ2V0Q2hpbGRyZW4odHJ1ZSkuZm9yRWFjaChmdW5jdGlvbiAoY2hpbGRyZW4sIGluZGV4KSB7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkcmVuLmdldCgnZXhwYW5kZWQnKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2hpbGRyZW4ucGFnaW5hdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZS5wYWdpbmF0aW9uLmZvY3VzT24oaW5kZXgpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF9leHBhbmROb2RlKGNoaWxkcmVuLCBfZGF0YUNhY2hlW2NoaWxkcmVuLmlkXSwgZnJvbUNhY2hlKTtcbiAgICAgICAgICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbGxhcHNlcyBub2RlIGFuZCByZW1vdmVzIGFsbCBjaGlsZHJlblxuICAgICAqIG9mIHRoZSBOb2RlIGZyb20gdGhlIGxheW91dC5cbiAgICAgKiBUaGVuIHJlY2FsY3VsYXRlcyBsYXlvdXQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVuYmluZEZyb20gLSBOb2RlIGlkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NvbGxhcHNlTm9kZSAodW5iaW5kRnJvbSkge1xuICAgICAgICBfbGF5b3V0LmNvbGxhcHNlTm9kZSh1bmJpbmRGcm9tKTtcbiAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIGxpc3Qgb2Ygc2VydmVyIG5vZGVzXG4gICAgICogdG8gTGlzdCBvZiBncmFwaCBub2Rlc1xuICAgICAqIEBwYXJhbSB7QXJyYXl9IHNlcnZlck5vZGVzIC0gTGlzdCBvZiBzZXJ2ZXIgbm9kZXNcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IEdyYXBoIG5vZGVzXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3ByZXBhcmVOb2RlcyAoc2VydmVyTm9kZXMpIHtcbiAgICAgICAgdmFyIG5vZGVzID0gW107XG5cbiAgICAgICAgc2VydmVyTm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgdmFyIG5ld05vZGUgPSBfY3JlYXRlTm9kZShub2RlKTtcbiAgICAgICAgICAgIG5vZGVzLnB1c2gobmV3Tm9kZSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbm9kZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgbGlzdCBvZiBzZXJ2ZXIgZWRnZXNcbiAgICAgKiB0byBMaXN0IG9mIGdyYXBoIGVkZ2VzXG4gICAgICogQHBhcmFtIHtBcnJheX0gc2VydmVyRWRnZSAtIExpc3Qgb2Ygc2VydmVyIGVkZ2VzXG4gICAgICogQHJldHVybnMge0FycmF5fSBHcmFwaCBlZGdlc1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9wcmVwYXJlRWRnZXMgKHNlcnZlckVkZ2UpIHtcbiAgICAgICAgdmFyIGVkZ2VzID0gW107XG5cbiAgICAgICAgc2VydmVyRWRnZS5mb3JFYWNoKGZ1bmN0aW9uIChlZGdlKSB7XG4gICAgICAgICAgICB2YXIgbmV3RWRnZSA9IF9jcmVhdGVFZGdlKGVkZ2UpO1xuICAgICAgICAgICAgZWRnZXMucHVzaChuZXdFZGdlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlZGdlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBzZXJ2ZXIgbm9kZVxuICAgICAqIHRvIGdyYXBoIG5vZGVcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gbm9kZSAtIFNlcnZlciBub2RlXG4gICAgICogQHJldHVybnMge05vZGV9IEdyYXBoIG5vZGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfY3JlYXRlTm9kZSAobm9kZSkge1xuICAgICAgICB2YXIgbmV3Tm9kZTtcblxuICAgICAgICBuZXdOb2RlID0gbmV3IE5vZGUoe1xuICAgICAgICAgICAgdHlwZUlkOiBub2RlLmlkLFxuICAgICAgICAgICAgbGFiZWw6IG5vZGUubGFiZWwsXG4gICAgICAgICAgICBjYW5FeHBhbmQ6IG5vZGUuY2FuRXhwYW5kLFxuICAgICAgICAgICAgZnVsbE5vZGVMYWJlbHM6IF9mdWxsTm9kZUxhYmVscyxcbiAgICAgICAgfSwgX29wdGlvbnMpO1xuICAgICAgICByZXR1cm4gbmV3Tm9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBzZXJ2ZXIgZWRnZVxuICAgICAqIHRvIGdyYXBoIGVkZ2VcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZWRnZSAtIFNlcnZlciBlZGdlXG4gICAgICogQHJldHVybnMge0VkZ2V9IEdyYXBoIGVkZ2VcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfY3JlYXRlRWRnZSAoZWRnZSkge1xuICAgICAgICB2YXIgbmV3RWRnZSA9IG5ldyBFZGdlKHtcbiAgICAgICAgICAgIHR5cGVJZDogZWRnZS5pZCxcbiAgICAgICAgICAgIHNvdXJjZVR5cGVJZDogZWRnZS5zb3VyY2UsXG4gICAgICAgICAgICB0YXJnZXRUeXBlSWQ6IGVkZ2UudGFyZ2V0LFxuICAgICAgICAgICAgbGFiZWw6IGVkZ2UubGFiZWwsXG4gICAgICAgICAgICBwbGFjZW1lbnQ6IGVkZ2UucGxhY2VtZW50LFxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG5ld0VkZ2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyBhbGwgbGluayBwYWdpbmF0aW9uIGNvbnRyb2xzIGluYWN0aXZlXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3NldExpbmtQYWdpbmF0aW9uQ29udHJvbHNJbmFjdGl2ZSAoKSB7XG4gICAgICAgIHZhciBub2RlcyA9IHNlbGYuZ2V0Tm9kZXMoKTtcbiAgICAgICAgbm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgICAgdmFyIHBhZ2luYXRpb24gPSBub2RlLmdldFBhZ2luYXRpb24oKTtcbiAgICAgICAgICAgIGlmIChwYWdpbmF0aW9uICYmIHBhZ2luYXRpb24uZ2V0VHlwZSgpID09PSAnZWRnZXMnKSB7XG4gICAgICAgICAgICAgICAgcGFnaW5hdGlvbi5zZXRJbmFjdGl2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIGxpbmsgcGFnaW5hdGlvbiBjb250cm9sIGFjdGl2ZVxuICAgICAqIHRvIGdyYXBoIGVkZ2VcbiAgICAgKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc2V0TGlua1BhZ2luYXRpb25Db250cm9sQWN0aXZlIChub2RlKSB7XG4gICAgICAgIHZhciBwYWdpbmF0aW9uID0gbm9kZS5nZXRQYWdpbmF0aW9uKCk7XG4gICAgICAgIGlmIChwYWdpbmF0aW9uICYmIHBhZ2luYXRpb24uZ2V0VHlwZSgpID09PSAnZWRnZXMnKSB7XG4gICAgICAgICAgICBwYWdpbmF0aW9uLnNldEFjdGl2ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX2FkZExvYWRpbmcgKG5vZGUpIHtcbiAgICAgICAgdmFyIGxvYWRpbmcgPSBuZXcgam9pbnQuc2hhcGVzLmJhc2ljLlJlY3Qoe1xuICAgICAgICAgICAgc2l6ZToge3dpZHRoOiA1NSwgaGVpZ2h0OiAxNX0sXG4gICAgICAgICAgICBhdHRyczoge1xuICAgICAgICAgICAgICAgIHJlY3Q6IHsnZmlsbC1vcGFjaXR5JzogMCwgJ3N0cm9rZS1vcGFjaXR5JzogMH0sXG4gICAgICAgICAgICAgICAgdGV4dDoge1xuICAgICAgICAgICAgICAgICAgICB0ZXh0OiAnTG9hZGluZy4uLicsXG4gICAgICAgICAgICAgICAgICAgICdmb250LWZhbWlseSc6ICdBcmlhbCwgSGVsdmV0aWNhLCBzYW5zLXNlcmlmJyxcbiAgICAgICAgICAgICAgICAgICAgJ2ZvbnQtc2l6ZSc6IDExXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHo6IDEwMFxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgeCA9IG5vZGUucG9zaXRpb24oKS54LFxuICAgICAgICAgICAgeSA9IG5vZGUucG9zaXRpb24oKS55O1xuXG4gICAgICAgIGlmIChub2RlLmlkID09PSBfbGF5b3V0LmdldFJvb3ROb2RlKCkuaWQpIHtcbiAgICAgICAgICAgIHggKz0gKG5vZGUuZ2V0U2l6ZSgpLndpZHRoIC0gbG9hZGluZy5nZXQoJ3NpemUnKS53aWR0aCkgLyAyO1xuICAgICAgICAgICAgeSAtPSBsb2FkaW5nLmdldCgnc2l6ZScpLmhlaWdodDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHkgKz0gKG5vZGUuZ2V0U2l6ZSgpLmhlaWdodCAtIGxvYWRpbmcuZ2V0KCdzaXplJykuaGVpZ2h0KSAvIDI7XG4gICAgICAgICAgICB2YXIgZGlyZWN0aW9uID0gbm9kZS5nZXREaXJlY3Rpb24oKTtcblxuICAgICAgICAgICAgaWYgKGRpcmVjdGlvbikge1xuICAgICAgICAgICAgICAgIHggKz0gbm9kZS5nZXRTaXplKCkud2lkdGg7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHggLT0gbG9hZGluZy5nZXQoJ3NpemUnKS53aWR0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGxvYWRpbmcucG9zaXRpb24oeCwgeSk7XG5cbiAgICAgICAgX2dyYXBoLmFkZENlbGwobG9hZGluZyk7XG4gICAgICAgIG5vZGUuZW1iZWQobG9hZGluZyk7XG5cbiAgICAgICAgcmV0dXJuIGxvYWRpbmc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlbW92ZUxvYWRpbmcgKGxvYWRpbmcpIHtcbiAgICAgICAgbG9hZGluZy5yZW1vdmUoKTtcbiAgICB9XG5cbiAgICAvLyBpbm5lciBjbGFzc1xuICAgIGZ1bmN0aW9uIFRyYW5zaXRpdmVDb3JlICgpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB2YXIgX3JlcGVhdGVkRWxlbWVudHMgPSBbXTtcbiAgICAgICAgdmFyIF9leHBhbmRDb3VudGVyID0gMDtcblxuICAgICAgICBzZWxmLmluaXRpYWxOb2RlID0gbnVsbDtcbiAgICAgICAgc2VsZi5pblVzZSA9IGZhbHNlO1xuICAgICAgICBcbiAgICAgICAgc2VsZi5zdGFydCA9IGZ1bmN0aW9uIChpbml0aWFsTm9kZSkge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICFpbml0aWFsTm9kZS5jb25maWd1cmF0aW9uU2V0LmV4cGFuZFRyYW5zaXRpdmVseSB8fFxuICAgICAgICAgICAgICAgICEoaW5pdGlhbE5vZGUgaW5zdGFuY2VvZiBOb2RlKVxuICAgICAgICAgICAgKSByZXR1cm47XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHNlbGYuaW5pdGlhbE5vZGUgPSBpbml0aWFsTm9kZTtcbiAgICAgICAgICAgIF9yZXBlYXRlZEVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBfZXhwYW5kQ291bnRlciA9IDA7XG5cbiAgICAgICAgICAgIF9leHBhbmRUcmFuc2l0aXZlbHkoaW5pdGlhbE5vZGUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIF9leHBhbmRUcmFuc2l0aXZlbHkgKGluaXRpYWxOb2RlKSB7XG4gICAgICAgICAgICBleHBhbmROb2RlKGluaXRpYWxOb2RlLCBmdW5jdGlvbiAocm9vdCwgbm9kZXMpIHtcbiAgICAgICAgICAgICAgICBfcmVjdXJzaXZlQ2FsbChub2Rlcyk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgZnVuY3Rpb24gZXhwYW5kTm9kZSAocm9vdCwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBpZiAoX3JlcGVhdGVkRWxlbWVudHMuaW5kZXhPZihyb290LmRhdGFNb2RlbC50eXBlSWQpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJvb3QsIG51bGwpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgX3JlcGVhdGVkRWxlbWVudHMucHVzaChyb290LmRhdGFNb2RlbC50eXBlSWQpO1xuICAgICAgICAgICAgICAgIF9leHBhbmRDb3VudGVyKys7XG5cbiAgICAgICAgICAgICAgICBpZiAocm9vdCBpbnN0YW5jZW9mIE5vZGUgJiYgIXJvb3QuZ2V0KCdleHBhbmRlZCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcm9vdC5nZXQoJ2hpZGRlbicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgbG9hZGluZyA9IF9hZGRMb2FkaW5nKHJvb3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX3NldExpbmtQYWdpbmF0aW9uQ29udHJvbHNJbmFjdGl2ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgX2FzeW5rT3BlcmF0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9yZXF1ZXN0RGF0YShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByb290LnR5cGVJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiBzdWNjZXNzQ2FsbGJhY2sgKHJlc3VsdCwgcHJvcHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5zZXQoJ2V4cGFuZGVkJywgdHJ1ZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFyb290LmdldCgnaGlkZGVuJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9zZXRMaW5rUGFnaW5hdGlvbkNvbnRyb2xBY3RpdmUocm9vdCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfYXN5bmtPcGVyYXRpb24gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9yZW1vdmVMb2FkaW5nKGxvYWRpbmcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2V4cGFuZE5vZGUocm9vdCwgcmVzdWx0LCBwcm9wcyAmJiBwcm9wcy5mcm9tQ2FjaGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXJvb3QuZ2V0KCdoaWRkZW4nKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2xheW91dC5yZWNhbGN1bGF0ZUxheW91dCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX3BhcGVyU2Nyb2xsZXIuem9vbVRvRml0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyb290LCByb290LmdldFZpc2libGVDaGlsZHJlbih0cnVlKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmdW5jdGlvbiAobWVzc2FnZSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcm9vdC5nZXQoJ2hpZGRlbicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfc2V0TGlua1BhZ2luYXRpb25Db250cm9sQWN0aXZlKHJvb3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2FzeW5rT3BlcmF0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfcmVtb3ZlTG9hZGluZyhsb2FkaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5ldyBqb2ludC51aS5EaWFsb2coe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpZHRoOiAzMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ0FsZXJ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkub3BlbigpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2socm9vdCwgW10pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocm9vdC5nZXQoJ2V4cGFuZGVkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayhyb290LCByb290LmdldFZpc2libGVDaGlsZHJlbih0cnVlKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBfcmVjdXJzaXZlQ2FsbCAobm9kZXMpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHZhciBuZXh0Tm9kZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB2YXIgc2hvdWxkQmVPcGVuZWQgPSBub2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcmVjdXJzaXZlQ3ljbGUoaW5kZXgpO1xuXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gcmVjdXJzaXZlQ3ljbGUgKGluZGV4KSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBub2RlID0gbm9kZXNbaW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICBpZiAobm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF9leHBhbmRDb3VudGVyID49IF9vcHRpb25zLlRSQU5TSVRJVkVfRVhQQU5TSU9OX0xJTUlUX1NURVApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZGlhbG9nID0gbmV3IGpvaW50LnVpLkRpYWxvZyh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICduZXV0cmFsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IDMwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdBbGVydCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6ICdUaGUgJyArIChfcmVwZWF0ZWRFbGVtZW50cy5sZW5ndGgpICsgJyBub2RlcyB3ZXJlIGV4cGFuZGVkLiBEbyB5b3Ugd2FudCB0byBjb250aW51ZT8nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbG9zZUJ1dHRvbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGFjdGlvbjogJ2NvbnRpbnVlJywgY29udGVudDogJ0NvbnRpbnVlJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBhY3Rpb246ICdzdG9wJywgY29udGVudDogJ1N0b3AnIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpYWxvZy5vbignYWN0aW9uOmNvbnRpbnVlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgX2V4cGFuZENvdW50ZXIgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBhbmROb2RlKG5vZGUsIGNhbGxCYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaWFsb2cub24oJ2FjdGlvbjpzdG9wJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaWFsb2cuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaWFsb2cub3BlbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHBhbmROb2RlKG5vZGUsIGNhbGxCYWNrKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIGNhbGxCYWNrIChyb290Tm9kZSwgbk5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobk5vZGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGZpbHRlcmVkTm9kZXMgPSBmaWx0ZXJMaXN0KG5Ob2Rlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZpbHRlcmVkTm9kZXMubGVuZ3RoID09PSAwICYmIG5vZGUucGFnaW5hdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgYWxsQ2hpbGRyZW4gPSByb290Tm9kZS5nZXRDaGlsZHJlbih0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGFsbEZpbHRlcmVkID0gZmlsdGVyTGlzdChhbGxDaGlsZHJlbik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbGxGaWx0ZXJlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgZmlyc3RHb29kID0gYWxsRmlsdGVyZWRbMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByb290Tm9kZS5wYWdpbmF0aW9uLmZvY3VzT25FbGVtZW50KGZpcnN0R29vZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbm9kZXNUb0FkZCA9IHJvb3ROb2RlLnBhZ2luYXRpb24uZ2V0Q3VycmVudE5vZGVzKHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dE5vZGVzID0gbmV4dE5vZGVzLmNvbmNhdChub2Rlc1RvQWRkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmlsdGVyZWROb2Rlcy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dE5vZGVzID0gbmV4dE5vZGVzLmNvbmNhdChuTm9kZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvdWxkQmVPcGVuZWQtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVjdXJzaXZlQ3ljbGUoaW5kZXggKyAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChub2Rlcy5maWx0ZXIoZnVuY3Rpb24gKG4pIHsgcmV0dXJuIG4uZ2V0KCdleHBhbmRlZCcpOyB9KS5sZW5ndGggPT09IHNob3VsZEJlT3BlbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3JlY3Vyc2l2ZUNhbGwobmV4dE5vZGVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gZmlsdGVyTGlzdCAobGlzdCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBsaXN0LmZpbHRlcihmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dE5vZGVzLm1hcChmdW5jdGlvbiAobikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG4uZGF0YU1vZGVsLnR5cGVJZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuaW5kZXhPZihuLmRhdGFNb2RlbC50eXBlSWQpID09PSAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIZXJlIHdlIGNhbGwgY29uc3RydWN0b3IgYWZ0ZXIgZGVmaW5pbmcgYWxsIGZ1bmN0aW9uc1xuICAgIF9pbml0aWFsaXplLmNhbGwoc2VsZiwgZGF0YVByb3ZpZGVyLCBwYXBlclByb3BlcnRpZXMsIGZvY3VzTm9kZUlkLCByZXNvdXJjZVBhdGgsIF9vcHRpb25zKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBOZWlnaGJvckdyYW07XG5cblxuIiwidmFyIGpvaW50ID0gcmVxdWlyZSgncmFwcGlkJyk7XG52YXIgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xudmFyIENyb3NzTm9kZSA9IHJlcXVpcmUoJy4vZ3JhcGhFbGVtZW50cycpLkNyb3NzTm9kZTtcblxudmFyIGRlZmF1bHRPcHRpb25zID0ge0RFRkFVTFRfUEFHRV9TSVpFOiA1fTtcblxuLy8gQ3JlYXRlIGEgY3VzdG9tIGVsZW1lbnQuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuaWYgKCFqb2ludC5zaGFwZXMuaHRtbCkgam9pbnQuc2hhcGVzLmh0bWwgPSB7fTtcblxuam9pbnQuc2hhcGVzLmh0bWwuUGFnaW5hdGlvbiA9IGpvaW50LnNoYXBlcy5iYXNpYy5SZWN0LmV4dGVuZCh7XG4gICAgZGVmYXVsdHM6IGpvaW50LnV0aWwuZGVlcFN1cHBsZW1lbnQoe1xuICAgICAgICB0eXBlOiAnaHRtbC5QYWdpbmF0aW9uJyxcbiAgICAgICAgYXR0cnM6IHtcbiAgICAgICAgICAgIHJlY3Q6IHtzdHJva2U6ICdub25lJywgJ2ZpbGwtb3BhY2l0eSc6IDAsIHN0eWxlOiB7J3BvaW50ZXItZXZlbnRzJzogJ25vbmUnfX1cbiAgICAgICAgfVxuICAgIH0sIGpvaW50LnNoYXBlcy5iYXNpYy5SZWN0LnByb3RvdHlwZS5kZWZhdWx0cylcbn0pO1xuXG4vLyBDcmVhdGUgYSBjdXN0b20gdmlldyBmb3IgdGhhdCBlbGVtZW50IHRoYXQgZGlzcGxheXMgYW4gSFRNTCBkaXYgYWJvdmUgaXQuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmpvaW50LnNoYXBlcy5odG1sLlBhZ2luYXRpb25WaWV3ID0gam9pbnQuZGlhLkVsZW1lbnRWaWV3LmV4dGVuZCh7XG5cbiAgICB0ZW1wbGF0ZTogW1xuICAgICAgICAnPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJuZy1wcmV2XCIgdGl0bGU9XCJQcmV2XCI+PC9idXR0b24+JyxcbiAgICAgICAgJzxkaXYgY2xhc3M9XCJuZy1wYWdlc1wiPjxzcGFuIGNsYXNzPVwibmctcGFnZXMtY3VyXCI+PC9zcGFuPi88c3BhbiBjbGFzcz1cIm5nLXBhZ2VzLXRvdGFsXCI+PC9zcGFuPjwvZGl2PicsXG4gICAgICAgICc8YnV0dG9uIHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5nLW5leHRcIiB0aXRsZT1cIk5leHRcIj48L2J1dHRvbj4nXG4gICAgXS5qb2luKCcnKSxcblxuICAgIGluaXRpYWxpemU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgXy5iaW5kQWxsKHRoaXMsICd1cGRhdGVCb3gnKTtcbiAgICAgICAgam9pbnQuZGlhLkVsZW1lbnRWaWV3LnByb3RvdHlwZS5pbml0aWFsaXplLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgICAgdGhpcy5ib3ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICAgICAgICBpZiAodGhpcy5tb2RlbC5nZXRUeXBlKCkgPT09ICdub2RlcycpIHtcbiAgICAgICAgICAgIHRoaXMuYm94LmNsYXNzTmFtZSA9ICduZy1wYWdpbmF0aW9uLW5vZGVzJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYm94LmNsYXNzTmFtZSA9ICduZy1wYWdpbmF0aW9uLWVkZ2VzJztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYm94LmlubmVySFRNTCA9IHRoaXMudGVtcGxhdGU7XG5cbiAgICAgICAgLy8gRXZlbnRzXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICB2YXIgYnV0dG9uUHJldiA9IHRoaXMuYm94LnF1ZXJ5U2VsZWN0b3IoJy5uZy1wcmV2Jyk7XG4gICAgICAgIHZhciBidXR0b25OZXh0ID0gdGhpcy5ib3gucXVlcnlTZWxlY3RvcignLm5nLW5leHQnKTtcblxuICAgICAgICBidXR0b25QcmV2Lm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLm1vZGVsLnByZXYoKTtcbiAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbnNTdGF0ZSgpO1xuICAgICAgICB9O1xuICAgICAgICBidXR0b25OZXh0Lm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLm1vZGVsLm5leHQoKTtcbiAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbnNTdGF0ZSgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIHVwZGF0ZUJ1dHRvbnNTdGF0ZSAoKSB7XG4gICAgICAgICAgICBidXR0b25QcmV2LmRpc2FibGVkID0gc2VsZi5tb2RlbC5zdGF0ZS5jdXJQYWdlID09PSAwO1xuICAgICAgICAgICAgYnV0dG9uTmV4dC5kaXNhYmxlZCA9IHNlbGYubW9kZWwuc3RhdGUuY3VyUGFnZSA9PT0gc2VsZi5tb2RlbC5zdGF0ZS5wYWdlQ291bnQgLSAxO1xuICAgICAgICB9XG4gICAgICAgIHVwZGF0ZUJ1dHRvbnNTdGF0ZSgpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgYm94IHBvc2l0aW9uIHdoZW5ldmVyIHRoZSB1bmRlcmx5aW5nIG1vZGVsIGNoYW5nZXMuXG4gICAgICAgIHRoaXMubW9kZWwub24oJ2NoYW5nZScsIHRoaXMudXBkYXRlQm94LCB0aGlzKTtcbiAgICAgICAgLy8gUmVtb3ZlIHRoZSBib3ggd2hlbiB0aGUgbW9kZWwgZ2V0cyByZW1vdmVkIGZyb20gdGhlIGdyYXBoLlxuICAgICAgICB0aGlzLm1vZGVsLm9uKCdyZW1vdmUnLCB0aGlzLnJlbW92ZUJveCwgdGhpcyk7XG4gICAgICAgIC8vIGlmIHdlIHVzZSB6b29tICsvLVxuICAgICAgICB0aGlzLm1vZGVsLm9uKCd1cGRhdGVWaWV3UG9zaXRpb24nLCB0aGlzLnVwZGF0ZUJveCwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5tb2RlbC5vbignc2V0QWN0aXZlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5hZGRDbGFzcygnYWN0aXZlJyk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB0aGlzLm1vZGVsLm9uKCdzZXRJbmFjdGl2ZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQ2xhc3MoJ2FjdGl2ZScpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICB0aGlzLm1vZGVsLm9uKCdzdGFydExvYWRpbmcnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmFkZENsYXNzKCdsb2FkaW5nJyk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgICAgICB0aGlzLm1vZGVsLm9uKCdmaW5pc2hMb2FkaW5nJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVDbGFzcygnbG9hZGluZycpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVQYWdlcygpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZUJveCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZVBhZ2VzKCk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgam9pbnQuZGlhLkVsZW1lbnRWaWV3LnByb3RvdHlwZS5yZW5kZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgdGhpcy5wYXBlci5lbC5hcHBlbmRDaGlsZCh0aGlzLmJveCk7XG4gICAgICAgIHRoaXMudXBkYXRlQm94KCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgdXBkYXRlQm94OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBiYm94ID0gdGhpcy5tb2RlbC5nZXRNeUJCb3goKTtcblxuICAgICAgICB0aGlzLmJveC5zdHlsZS53aWR0aCA9IGJib3gud2lkdGggKyAncHgnO1xuICAgICAgICB0aGlzLmJveC5zdHlsZS5oZWlnaHQgPSBiYm94LmhlaWdodCArICdweCc7XG4gICAgICAgIHRoaXMuYm94LnN0eWxlLmxlZnQgPSBiYm94LnggKyAncHgnO1xuICAgICAgICB0aGlzLmJveC5zdHlsZS50b3AgPSBiYm94LnkgKyAncHgnO1xuICAgICAgICB0aGlzLmJveC5zdHlsZS50cmFuc2Zvcm0gPSAncm90YXRlKCcgKyAodGhpcy5tb2RlbC5nZXQoJ2FuZ2xlJykgfHwgMCkgKyAnZGVnKSc7XG4gICAgfSxcbiAgICByZW1vdmVCb3g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5ib3gucmVtb3ZlKCk7XG4gICAgfSxcbiAgICB1cGRhdGVQYWdlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmJveC5xdWVyeVNlbGVjdG9yKCcubmctcGFnZXMtY3VyJykuaW5uZXJIVE1MID0gdGhpcy5tb2RlbC5nZXRTdGF0ZSgpLmN1clBhZ2UgKyAxO1xuICAgICAgICB0aGlzLmJveC5xdWVyeVNlbGVjdG9yKCcubmctcGFnZXMtdG90YWwnKS5pbm5lckhUTUwgPSB0aGlzLm1vZGVsLmdldFN0YXRlKCkucGFnZUNvdW50O1xuICAgIH0sXG4gICAgYWRkQ2xhc3M6IGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgdGhpcy5ib3guY2xhc3NOYW1lID0gdGhpcy5ib3guY2xhc3NOYW1lICsgJyAnICsgY2xhc3NOYW1lO1xuICAgIH0sXG4gICAgcmVtb3ZlQ2xhc3M6IGZ1bmN0aW9uIChjbGFzc05hbWUpIHtcbiAgICAgICAgdmFyIGJveCA9IHRoaXMuYm94O1xuICAgICAgICB2YXIgY2xhc3NlcyA9IGJveC5jbGFzc05hbWUuc3BsaXQoJyAnKTtcblxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNsYXNzZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2ldID09IGNsYXNzTmFtZSkge1xuICAgICAgICAgICAgICAgIGNsYXNzZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIGktLTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBib3guY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJyk7XG4gICAgfVxufSk7XG5cbi8qKlxuICogUGFnaW5hdGlvbiAtIGl0IHdpbGwgYmUgbmV3IGdyYXBoIGVsZW1lbnQsXG4gKiB3aGljaCBwcm92aWRlcyBwYWdpbmF0aW9uXG4gKlxuICogQ29uc3RydWN0b3IgcGFyYW1ldGVyczpcbiAqICAgICAgbm9kZTogTm9kZVxuICogICAgICBfbGF5b3V0OiBHcmFwaExheW91dFxuICogICAgICBwYWdlU2l6ZTogbnVtYmVyXG4gKiAgICAgIHR5cGU6IHN0cmluZ1xuICogICAgICBfb3B0aW9uczoge1xuICogICAgICAgICAgREVGQVVMVF9QQUdFX1NJWkU6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xPUl9DTEFTU19DT1VOVDogbnVtYmVyLCBcbiAqICAgICAgICAgIE1BWF9MQUJFTF9MRU5HVEg6IG51bWJlciwgXG4gKiAgICAgICAgICBDT0xfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgUk9XX09GRlNFVDogbnVtYmVyLCBcbiAqICAgICAgICAgIENST1NTX05PREVfT0ZGU0VUOiBudW1iZXIsIFxuICogICAgICAgICAgQ09MT1JfQ0xBU1NfTUFQOiB7XG4gKiAgICAgICAgICAgICAgJ3N1YkNsYXNzT2YnOiBzdHJpbmcsIFxuICogICAgICAgICAgICAgICd0eXBlJzogc3RyaW5nXG4gKiAgICAgICAgICB9XG4gKiAgICAgIH1cbiAqXG4gKiBQdWJsaWMgbWV0aG9kczpcbiAqICAgICAgbmV4dCgpOiB2b2lkXG4gKiAgICAgIHByZXYoKTogdm9pZFxuICogICAgICBnZXRTdGF0ZSgpOiB7IHRvdGFsQ291bnQ6IG51bWJlciwgcGFnZVNpemU6IG51bWJlciwgY3VyUGFnZTogbnVtYmVyLCBwYWdlQ291bnQ6IG51bWJlciB9XG4gKiAgICAgIGdldFR5cGUoKTogc3RyaW5nXG4gKiAgICAgIGdldE15QkJveCgpOiByZXR1cm4ge3dpZHRoOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCB4OiBudW1iZXIsIHk6IG51bWJlcn1cbiAqICAgICAgdXBkYXRlVmlld1Bvc2l0aW9uKCk6IHZvaWRcbiAqICAgICAgc2V0QWN0aXZlKCk6IHZvaWRcbiAqICAgICAgc2V0SW5hY3RpdmUoKTogdm9pZFxuICovXG5mdW5jdGlvbiBQYWdpbmF0aW9uIChub2RlLCBfbGF5b3V0LCBwYWdlU2l6ZSwgdHlwZSwgX29wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgREVGQVVMVF9QQUdFX1NJWkUgPSAoX29wdGlvbnMgJiYgX29wdGlvbnMuREVGQVVMVF9QQUdFX1NJWkUgIT0gdW5kZWZpbmVkID8gX29wdGlvbnMuREVGQVVMVF9QQUdFX1NJWkUgOiBkZWZhdWx0T3B0aW9ucy5ERUZBVUxUX1BBR0VfU0laRSk7XG5cbiAgICBmdW5jdGlvbiBpbml0aWFsaXplIChub2RlLCBsYXlvdXQsIHBhZ2VTaXplLCB0eXBlKSB7XG5cbiAgICAgICAgdmFyIHRvdGFsQ291bnQgPSBub2RlLmdldENoaWxkcmVuKCkubGVuZ3RoO1xuICAgICAgICBwYWdlU2l6ZSA9IChwYWdlU2l6ZSA/IHBhZ2VTaXplIDogREVGQVVMVF9QQUdFX1NJWkUpO1xuXG5cbiAgICAgICAgc2VsZi5zdGF0ZSA9IHtcbiAgICAgICAgICAgIHRvdGFsQ291bnQ6IHRvdGFsQ291bnQsXG4gICAgICAgICAgICBwYWdlU2l6ZTogcGFnZVNpemUsXG4gICAgICAgICAgICBjdXJQYWdlOiAwLFxuICAgICAgICAgICAgcHJldlBhZ2U6IDAsXG4gICAgICAgICAgICBwYWdlQ291bnQ6IE1hdGguY2VpbCh0b3RhbENvdW50IC8gcGFnZVNpemUpXG4gICAgICAgIH07XG4gICAgICAgIHNlbGYudHlwZSA9IHR5cGU7XG4gICAgICAgIHNlbGYucmVmcmVzaExheW91dCA9IGxheW91dC5yZWNhbGN1bGF0ZUxheW91dDtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IHNlbGYudHlwZSA9PT0gJ25vZGVzJyA/IHtzaXplOiB7d2lkdGg6IDEwMCwgaGVpZ2h0OiAyM319IDoge3NpemU6IHt3aWR0aDogMjAsIGhlaWdodDogNDZ9fTtcblxuICAgICAgICBqb2ludC5zaGFwZXMuaHRtbC5QYWdpbmF0aW9uLmFwcGx5KHNlbGYsIFtvcHRpb25zXSk7XG4gICAgfVxuXG4gICAgLy8gZ28gdG8gbmV4dCBwYWdlXG4gICAgc2VsZi5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5zdGF0ZS5jdXJQYWdlIDwgc2VsZi5zdGF0ZS5wYWdlQ291bnQgLSAxKSB7XG4gICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ3N0YXJ0TG9hZGluZycpO1xuICAgICAgICAgICAgc2VsZi5zdGF0ZS5wcmV2UGFnZSA9IHNlbGYuc3RhdGUuY3VyUGFnZTtcbiAgICAgICAgICAgIHNlbGYuc3RhdGUuY3VyUGFnZSsrO1xuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWZyZXNoTGF5b3V0KCk7XG4gICAgICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdmaW5pc2hMb2FkaW5nJyk7XG4gICAgICAgICAgICB9LCA1MCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gcmV0dXJucyBub2RlcyBvZiBjdXJyZW50IHBhZ2VcbiAgICBzZWxmLmdldEN1cnJlbnROb2RlcyA9IGZ1bmN0aW9uIChleHBhbmRDcm9zc05vZGVzKSB7XG4gICAgICAgIHZhciBwYWdlU2l6ZSA9IHNlbGYuc3RhdGUucGFnZVNpemU7XG4gICAgICAgIHZhciBjdXJQYWdlID0gIHNlbGYuc3RhdGUuY3VyUGFnZTtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gbm9kZS5nZXRDaGlsZHJlbihleHBhbmRDcm9zc05vZGVzKTtcbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuLnNsaWNlKHBhZ2VTaXplICogY3VyUGFnZSwgKGN1clBhZ2UgKyAxKSAqIHBhZ2VTaXplKTtcbiAgICB9O1xuXG4gICAgLy8gZ28gdG8gcHJldmlvdXMgcGFnZVxuICAgIHNlbGYucHJldiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYuc3RhdGUuY3VyUGFnZSAhPT0gMCkge1xuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdzdGFydExvYWRpbmcnKTtcbiAgICAgICAgICAgIHNlbGYuc3RhdGUucHJldlBhZ2UgPSBzZWxmLnN0YXRlLmN1clBhZ2U7XG4gICAgICAgICAgICBzZWxmLnN0YXRlLmN1clBhZ2UtLTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVmcmVzaExheW91dCgpO1xuICAgICAgICAgICAgICAgIHNlbGYudHJpZ2dlcignZmluaXNoTG9hZGluZycpO1xuICAgICAgICAgICAgfSwgNTApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGdvIHRvIHNwZWNpZmljIHBhZ2VcbiAgICBzZWxmLmdvVG8gPSBmdW5jdGlvbiAobnVtYmVyKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAgIG51bWJlciA8PSBzZWxmLnN0YXRlLnBhZ2VDb3VudCAmJlxuICAgICAgICAgICAgbnVtYmVyID49IDAgJiZcbiAgICAgICAgICAgIG51bWJlciAhPT0gc2VsZi5zdGF0ZS5jdXJQYWdlXG4gICAgICAgICkge1xuICAgICAgICAgICAgc2VsZi50cmlnZ2VyKCdzdGFydExvYWRpbmcnKTtcbiAgICAgICAgICAgIHNlbGYuc3RhdGUucHJldlBhZ2UgPSBzZWxmLnN0YXRlLmN1clBhZ2U7XG4gICAgICAgICAgICBzZWxmLnN0YXRlLmN1clBhZ2UgPSBudW1iZXI7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlZnJlc2hMYXlvdXQoKTtcbiAgICAgICAgICAgICAgICBzZWxmLnRyaWdnZXIoJ2ZpbmlzaExvYWRpbmcnKTtcbiAgICAgICAgICAgIH0sIDUwKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLmdldFBhZ2VCeUVsZW1lbnRJbmRleCA9IGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgICBpZiAoaW5kZXggPiBzZWxmLnN0YXRlLnRvdGFsQ291bnQpIHJldHVybiAtMTtcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoaW5kZXggLyBzZWxmLnN0YXRlLnBhZ2VTaXplKTtcbiAgICB9O1xuXG4gICAgc2VsZi5mb2N1c09uID0gZnVuY3Rpb24gKGVsZW1lbnRJbmRleCkge1xuICAgICAgICBzZWxmLmdvVG8oc2VsZi5nZXRQYWdlQnlFbGVtZW50SW5kZXgoZWxlbWVudEluZGV4KSk7XG4gICAgfTtcblxuICAgIHNlbGYuZm9jdXNPbkVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSBub2RlLmdldENoaWxkcmVuKCk7XG4gICAgICAgIHZhciBpbmRleCA9IGNoaWxkcmVuLmluZGV4T2YoZWxlbWVudCk7XG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHZhciBjcm9zc05vZGVzID0gY2hpbGRyZW4uZmlsdGVyKGZ1bmN0aW9uIChuKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG4gaW5zdGFuY2VvZiBDcm9zc05vZGU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY3Jvc3NOb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBjcm9zc0NoaWxkcmVuID0gY3Jvc3NOb2Rlc1tpXS5nZXRDaGlsZHJlbigpO1xuICAgICAgICAgICAgICAgIGlmIChjcm9zc0NoaWxkcmVuLmluZGV4T2YoZWxlbWVudCkgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjcm9zc0NoaWxkcmVuLnBhZ2luYXRpb24pIGNyb3NzQ2hpbGRyZW4ucGFnaW5hdGlvbi5mb2N1c09uRWxlbWVudChlbGVtZW50KTtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBjaGlsZHJlbi5pbmRleE9mKGNyb3NzTm9kZXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2VsZi5nb1RvKHNlbGYuZ2V0UGFnZUJ5RWxlbWVudEluZGV4KGluZGV4KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGYuZ29UbyhzZWxmLmdldFBhZ2VCeUVsZW1lbnRJbmRleChpbmRleCkpO1xuICAgICAgICB9XG4gICAgfTtcblxuXG4gICAgc2VsZi5nZXRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuc3RhdGU7XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0VHlwZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYudHlwZTtcbiAgICB9O1xuXG4gICAgc2VsZi5nZXRNeUJCb3ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzaXplID0gc2VsZi5nZXQoJ3NpemUnKTtcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gc2VsZi5wb3NpdGlvbigpO1xuICAgICAgICB2YXIgc2NhbGUgPSBfbGF5b3V0LmdldFNjYWxlKCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogc2l6ZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc2l6ZS5oZWlnaHQsXG4gICAgICAgICAgICB4OiBwb3NpdGlvbi54ICogc2NhbGUuc3gsXG4gICAgICAgICAgICB5OiBwb3NpdGlvbi55ICogc2NhbGUuc3lcbiAgICAgICAgfTtcbiAgICB9O1xuXG4gICAgc2VsZi51cGRhdGVWaWV3UG9zaXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYudHJpZ2dlcigndXBkYXRlVmlld1Bvc2l0aW9uJyk7XG4gICAgfTtcblxuICAgIHNlbGYuc2V0QWN0aXZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnRyaWdnZXIoJ3NldEFjdGl2ZScpO1xuICAgIH07XG5cbiAgICBzZWxmLnNldEluYWN0aXZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnRyaWdnZXIoJ3NldEluYWN0aXZlJyk7XG4gICAgfTtcblxuICAgIGluaXRpYWxpemUobm9kZSwgX2xheW91dCwgcGFnZVNpemUsIHR5cGUpO1xufVxuUGFnaW5hdGlvbi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGpvaW50LnNoYXBlcy5odG1sLlBhZ2luYXRpb24ucHJvdG90eXBlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBQYWdpbmF0aW9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIGNsb25lRGVlcCA9IHJlcXVpcmUoJ2xvZGFzaCcpLmNsb25lRGVlcDtcblxuLyoqXG4gKiBcbiAqIEBwYXJhbSB7XG4gKiAgYmFzZTogSFRNTEVsZW1lbnQsXG4gKiAgdGFyZ2V0OiBOb2RlLFxuICogIHNjcm9sbGVyOiBqb2ludC51aS5QYXBlclNjcm9sbGVyXG4gKiB9IF9vcHRpb25zIFxuICovXG5mdW5jdGlvbiBQb3BVcE1lbnUgKG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBzZWxmLmFsaXZlID0gdHJ1ZTtcbiAgICBzZWxmLnRlbXBDb25maWd1cmF0aW9uID0gY2xvbmVEZWVwKG9wdGlvbnMudGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQpO1xuICAgIHNlbGYudGVtcENvbmZpZ3VyYXRpb24ubW9kaWZpZWQgPSB0cnVlO1xuXG4gICAgdmFyIF9iYXNlID0gb3B0aW9ucy5iYXNlO1xuICAgIHZhciBfdGFyZ2V0ID0gc2VsZi50YXJnZXQgPSBvcHRpb25zLnRhcmdldDtcbiAgICB2YXIgX3Njcm9sbGVyID0gb3B0aW9ucy5zY3JvbGxlcjtcblxuICAgIHZhciBfc2VhcmNoSW5wdXQgPSBudWxsO1xuICAgIHZhciBfbGlua3NSb3cgPSBudWxsO1xuICAgIHZhciBfcmFkaW9CdXR0b25zID0gbnVsbDtcbiAgICBcbiAgICB2YXIgX3Jvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdESVYnKTtcbiAgICBfY3JlYXRlTWFya3VwKCk7XG5cbiAgICB2YXIgdGFyZ2V0UG9zaXRpb24gPSBfZ2V0VGFyZ2V0UG9zaXRpb24oKTtcbiAgICBfdXBkYXRlUG9zaXRpb24odGFyZ2V0UG9zaXRpb24pO1xuXG4gICAgaWYgKF90YXJnZXQgJiYgX3RhcmdldC5vbikge1xuICAgICAgICBfdGFyZ2V0Lm9uKCdjaGFuZ2U6cG9zaXRpb24nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBfcmVmcmVzaCgpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfc2Nyb2xsZXIub3B0aW9ucy5wYXBlci5vbignYmxhbms6cG9pbnRlcmRvd24nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucmVtb3ZlKCk7XG4gICAgfSk7XG5cbiAgICBfc2Nyb2xsZXIub3B0aW9ucy5wYXBlci5vbignY2hhbmdlOmN1c3RvbVBvc2l0aW9uJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnJlZnJlc2goKTtcbiAgICB9KTtcblxuICAgIF90YXJnZXQub24oJ2NoYW5nZTpoaWRkZW4nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucmVtb3ZlKCk7XG4gICAgfSk7XG5cbiAgICBfc2Nyb2xsZXIuc2Nyb2xsVG9FbGVtZW50KF90YXJnZXQpO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHNlbGYucmVtb3ZlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5hbGl2ZSkge1xuICAgICAgICAgICAgX2Jhc2UucmVtb3ZlQ2hpbGQoX3Jvb3QpO1xuICAgICAgICAgICAgc2VsZi5hbGl2ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYucmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYuYWxpdmUpIHtcbiAgICAgICAgICAgIF9yZWZyZXNoKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgc2VsZi5wdXREYXRhID0gZnVuY3Rpb24gKGVkZ2VzKSB7XG4gICAgICAgIHZhciBjb25uZWN0aW9ucyA9IF9jcmVhdGVDb25uZWN0aW9uc0xpc3QoZWRnZXMpO1xuICAgICAgICBfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQuY29ubmVjdGlvbnMgPSBjb25uZWN0aW9ucztcbiAgICAgICAgX3JlZnJlc2goKTtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gX2NyZWF0ZU1hcmt1cCAoKSB7XG4gICAgICAgIF9yb290LmNsYXNzTmFtZSA9ICduZy11aV9wb3AtdXAnO1xuICAgICAgICBfcm9vdC5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgICAgIF9iYXNlLmFwcGVuZENoaWxkKF9yb290KTtcblxuICAgICAgICB2YXIgYm9keSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0RJVicpO1xuICAgICAgICBib2R5LmNsYXNzTmFtZSA9ICduZy11aV9wb3AtdXBfYm9keSc7XG4gICAgICAgIF9yb290LmFwcGVuZENoaWxkKGJvZHkpO1xuXG4gICAgICAgIHZhciBzZWFyY2hSb3cgPSBjcmVhdGVSb3coJ25nLXVpX3BvcC11cF9ib2R5X3NlYXJjaC1yb3cnKTtcbiAgICAgICAgX3NlYXJjaElucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnSU5QVVQnKTtcbiAgICAgICAgX3NlYXJjaElucHV0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0Jyk7XG4gICAgICAgIF9zZWFyY2hJbnB1dC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgJ1NlYXJjaC4uJyk7XG4gICAgICAgIF9zZWFyY2hJbnB1dC5jbGFzc05hbWU9J25nLXVpX3BvcC11cF9ib2R5X3NlYXJjaC1yb3dfX2lucHV0JztcbiAgICAgICAgc2VhcmNoUm93LmFwcGVuZENoaWxkKF9zZWFyY2hJbnB1dCk7XG4gICAgICAgIF9zZWFyY2hJbnB1dC5vbmtleXVwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5maWx0ZXJLZXkgPSBfc2VhcmNoSW5wdXQudmFsdWU7XG4gICAgICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QoKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgcmFkaW9Sb3cgPSBjcmVhdGVSb3coJ25nLXVpX3BvcC11cF9ib2R5X3JhZGlvLXJvdycsICdGT1JNJyk7XG4gICAgICAgIHJhZGlvUm93Lm5hbWUgPSAnZmlsdGVyVHlwZUZvcm0nO1xuICAgICAgICByYWRpb1Jvdy5pbm5lckhUTUwgPSBcbiAgICAgICAgICAgICc8c3BhbiBjbGFzcz1cIm5nLXVpX3BvcC11cF9ib2R5X3JhZGlvLXJvd19fcmFkaW8tYnV0dG9uXCI+JyArIFxuICAgICAgICAgICAgICAgICc8aW5wdXQgY2xhc3M9XCJuZy11aV9wb3AtdXBfYm9keV9yYWRpby1yb3dfX3JhZGlvLWJ1dHRvbi1pbnB1dFwiIG5hbWU9XCJmaWx0ZXJUeXBlXCIgdmFsdWU9XCJBTExcIiB0eXBlPVwicmFkaW9cIiAvPicgK1xuICAgICAgICAgICAgICAgICc8aW1nIGNsYXNzPVwibmctYWxsLWNvbm5lY3Rpb25zXCIvPicgK1xuICAgICAgICAgICAgICAgICc8bGFiZWw+IEJvdGg8L2xhYmVsPicgK1xuICAgICAgICAgICAgJzwvc3Bhbj4nICtcbiAgICAgICAgICAgICc8c3BhbiBjbGFzcz1cIm5nLXVpX3BvcC11cF9ib2R5X3JhZGlvLXJvd19fcmFkaW8tYnV0dG9uXCI+JyArIFxuICAgICAgICAgICAgICAgICc8aW5wdXQgY2xhc3M9XCJuZy11aV9wb3AtdXBfYm9keV9yYWRpby1yb3dfX3JhZGlvLWJ1dHRvbi1pbnB1dFwiIG5hbWU9XCJmaWx0ZXJUeXBlXCIgdmFsdWU9XCJJTkNPTUlOR1wiIHR5cGU9XCJyYWRpb1wiIC8+JyArXG4gICAgICAgICAgICAgICAgJzxpbWcgY2xhc3M9XCJuZy1pbmNvbWluZy1jb25uZWN0aW9uc1wiLz4nICtcbiAgICAgICAgICAgICAgICAnPGxhYmVsPiBJbmNvbWluZzwvbGFiZWw+JyArXG4gICAgICAgICAgICAnPC9zcGFuPicgK1xuICAgICAgICAgICAgJzxzcGFuIGNsYXNzPVwibmctdWlfcG9wLXVwX2JvZHlfcmFkaW8tcm93X19yYWRpby1idXR0b25cIj4nICsgXG4gICAgICAgICAgICAgICAgJzxpbnB1dCBjbGFzcz1cIm5nLXVpX3BvcC11cF9ib2R5X3JhZGlvLXJvd19fcmFkaW8tYnV0dG9uLWlucHV0XCIgbmFtZT1cImZpbHRlclR5cGVcIiB2YWx1ZT1cIk9VVEdPSU5HXCIgdHlwZT1cInJhZGlvXCIgLz4nICtcbiAgICAgICAgICAgICAgICAnPGltZyBjbGFzcz1cIm5nLW91dGdvaW5nLWNvbm5lY3Rpb25zXCIvPicgK1xuICAgICAgICAgICAgICAgICc8bGFiZWw+IE91dGdvaW5nPC9sYWJlbD4nICtcbiAgICAgICAgICAgICc8L3NwYW4+JztcbiAgICAgICAgX3JhZGlvQnV0dG9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm1bbmFtZT1maWx0ZXJUeXBlRm9ybV0nKS5xdWVyeVNlbGVjdG9yQWxsKCdpbnB1dFtuYW1lPWZpbHRlclR5cGVdJyk7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBfcmFkaW9CdXR0b25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBfcmFkaW9CdXR0b25zW2ldLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5maWx0ZXJUeXBlID0gdGhpcy52YWx1ZTtcbiAgICAgICAgICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJhZGlvUm93QnV0dG9ucyA9IHJhZGlvUm93LnF1ZXJ5U2VsZWN0b3JBbGwoJy5uZy11aV9wb3AtdXBfYm9keV9yYWRpby1yb3dfX3JhZGlvLWJ1dHRvbicpO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcmFkaW9Sb3dCdXR0b25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICByYWRpb1Jvd0J1dHRvbnNbaV0ub25jbGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5wdXQgPSB0aGlzLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gICAgICAgICAgICAgICAgaW5wdXQuY2hlY2tlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5maWx0ZXJUeXBlID0gaW5wdXQudmFsdWU7XG4gICAgICAgICAgICAgICAgX3VwZGF0ZUNvbm5lY3Rpb25MaXN0KCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHRyYW5zaXRpdmVSb3cgPSBjcmVhdGVSb3coJ25nLXVpX3BvcC11cF9ib2R5X3RyYW5zaXRpdmUtcm93Jyk7XG4gICAgICAgIHZhciB0cmFuc2l0aXZlQ2hlY2tCb3ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdJTlBVVCcpO1xuICAgICAgICB0cmFuc2l0aXZlQ2hlY2tCb3guc2V0QXR0cmlidXRlKCd0eXBlJywgJ2NoZWNrQm94Jyk7XG4gICAgICAgIHRyYW5zaXRpdmVDaGVja0JveC5jaGVja2VkID0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5leHBhbmRUcmFuc2l0aXZlbHk7XG4gICAgICAgIHRyYW5zaXRpdmVSb3cuYXBwZW5kQ2hpbGQodHJhbnNpdGl2ZUNoZWNrQm94KTtcbiAgICAgICAgdHJhbnNpdGl2ZVJvdy5vbmNsaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdHJhbnNpdGl2ZUNoZWNrQm94LmNoZWNrZWQgPSAhdHJhbnNpdGl2ZUNoZWNrQm94LmNoZWNrZWQ7XG4gICAgICAgICAgICBzZWxmLnRlbXBDb25maWd1cmF0aW9uLmV4cGFuZFRyYW5zaXRpdmVseSA9IHRyYW5zaXRpdmVDaGVja0JveC5jaGVja2VkO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgdHJhbnNpdGl2ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnTEFCRUwnKTtcbiAgICAgICAgdHJhbnNpdGl2ZUxhYmVsLmlubmVyVGV4dCA9ICdUcmFuc2l0aXZlIGV4cGFuc2lvbic7XG4gICAgICAgIHRyYW5zaXRpdmVSb3cuYXBwZW5kQ2hpbGQodHJhbnNpdGl2ZUxhYmVsKTtcblxuICAgICAgICBfbGlua3NSb3cgPSBjcmVhdGVSb3coJ25nLXVpX3BvcC11cF9ib2R5X2xpbmtzLXJvdycpO1xuICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QgKF9saW5rc1Jvdyk7XG5cbiAgICAgICAgdmFyIGJ1dHRvbnNSb3cgPSBjcmVhdGVSb3coJ25nLXVpX3BvcC11cF9ib2R5X2J1dHRvbnMtcm93Jyk7XG5cbiAgICAgICAgdmFyIHNlbGVjdEFsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0JVVFRPTicpO1xuICAgICAgICBzZWxlY3RBbGwuY2xhc3NOYW1lID0gJ25nLXVpX3BvcC11cF9ib2R5X2J1dHRvbnMtcm93X2J1dHRvbiB0cS1idXR0b24nO1xuICAgICAgICBzZWxlY3RBbGwuaW5uZXJUZXh0ID0gJ1NlbGVjdCBhbGwnO1xuICAgICAgICBidXR0b25zUm93LmFwcGVuZENoaWxkKHNlbGVjdEFsbCk7XG4gICAgICAgIHNlbGVjdEFsbC5vbmNsaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2hlY2tBbGwodHJ1ZSk7XG4gICAgICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QoKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgY2xlYXJTZWxlY3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdCVVRUT04nKTtcbiAgICAgICAgY2xlYXJTZWxlY3Rpb24uY2xhc3NOYW1lID0gJ25nLXVpX3BvcC11cF9ib2R5X2J1dHRvbnMtcm93X2J1dHRvbiB0cS1idXR0b24nO1xuICAgICAgICBjbGVhclNlbGVjdGlvbi5pbm5lclRleHQgPSAnQ2xlYXIgc2VsZWN0aW9uJztcbiAgICAgICAgYnV0dG9uc1Jvdy5hcHBlbmRDaGlsZChjbGVhclNlbGVjdGlvbik7XG4gICAgICAgIGNsZWFyU2VsZWN0aW9uLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBjaGVja0FsbChmYWxzZSk7XG4gICAgICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QoKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ1NQQU4nKTtcbiAgICAgICAgc3Bhbi5zdHlsZS5mbGV4R3JvdyA9IDE7XG4gICAgICAgIGJ1dHRvbnNSb3cuYXBwZW5kQ2hpbGQoc3Bhbik7XG5cbiAgICAgICAgdmFyIHJlc2V0RmlsdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnQlVUVE9OJyk7XG4gICAgICAgIHJlc2V0RmlsdGVyLmNsYXNzTmFtZSA9ICduZy11aV9wb3AtdXBfYm9keV9idXR0b25zLXJvd19idXR0b24gdHEtYnV0dG9uJztcbiAgICAgICAgcmVzZXRGaWx0ZXIuaW5uZXJUZXh0ID0gJ1Jlc2V0IGZpbHRlcic7XG4gICAgICAgIGJ1dHRvbnNSb3cuYXBwZW5kQ2hpbGQocmVzZXRGaWx0ZXIpO1xuICAgICAgICByZXNldEZpbHRlci5vbmNsaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIHBhcmVudCA9IF90YXJnZXQuZ2V0UGFyZW50KCk7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5iZWZvcmVBcHBseSkgb3B0aW9ucy5iZWZvcmVBcHBseShfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgX3RhcmdldC5jb25maWd1cmF0aW9uU2V0ID0gY2xvbmVEZWVwKHBhcmVudC5jb25maWd1cmF0aW9uU2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgX3RhcmdldC5jb25maWd1cmF0aW9uU2V0ID0ge1xuICAgICAgICAgICAgICAgICAgICBmaWx0ZXJUeXBlOiAnQUxMJywgLy8gSU5DT01JTkcsIE9VVEdPSU5HXG4gICAgICAgICAgICAgICAgICAgIGZpbHRlcktleTogJycsXG4gICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHlNYXA6IHt9LFxuICAgICAgICAgICAgICAgICAgICB2aXNpYmlsaXR5TWFwUmV2ZXJzZToge30sXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX3RhcmdldC5jb25maWd1cmF0aW9uU2V0LmNvbm5lY3Rpb25zID0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5jb25uZWN0aW9ucztcbiAgICAgICAgICAgIF90YXJnZXQuY29uZmlndXJhdGlvblNldC5tb2RpZmllZCA9IGZhbHNlO1xuICAgICAgICAgICAgc2VsZi50ZW1wQ29uZmlndXJhdGlvbiA9IGNsb25lRGVlcChfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQpO1xuICAgICAgICAgICAgc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5tb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICBfdXBkYXRlQ29ubmVjdGlvbkxpc3QoKTtcbiAgICAgICAgICAgIHNlbGYucmVtb3ZlKCk7XG5cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmFmdGVyQXBwbHkpIG9wdGlvbnMuYWZ0ZXJBcHBseShfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBnbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0JVVFRPTicpO1xuICAgICAgICBnby5jbGFzc05hbWUgPSAnbmctdWlfcG9wLXVwX2JvZHlfYnV0dG9ucy1yb3dfYnV0dG9uIGdvLWJ1dHRvbic7XG4gICAgICAgIGdvLmlubmVyVGV4dCA9ICdHbyc7XG4gICAgICAgIGdvLm9uY2xpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5iZWZvcmVBcHBseSkgb3B0aW9ucy5iZWZvcmVBcHBseShfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQpO1xuXG4gICAgICAgICAgICBfdGFyZ2V0LmNvbmZpZ3VyYXRpb25TZXQgPSBzZWxmLnRlbXBDb25maWd1cmF0aW9uO1xuICAgICAgICAgICAgc2VsZi5yZW1vdmUoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKG9wdGlvbnMuYWZ0ZXJBcHBseSkgb3B0aW9ucy5hZnRlckFwcGx5KF90YXJnZXQuY29uZmlndXJhdGlvblNldCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgYnV0dG9uc1Jvdy5hcHBlbmRDaGlsZChnbyk7XG5cbiAgICAgICAgZnVuY3Rpb24gY3JlYXRlUm93IChjbGFzc05hbWUsIHRlZykge1xuICAgICAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGVnIHx8ICdESVYnKTtcbiAgICAgICAgICAgIHJvdy5jbGFzc05hbWUgPSBjbGFzc05hbWU7XG4gICAgICAgICAgICBib2R5LmFwcGVuZENoaWxkKHJvdyk7XG4gICAgICAgICAgICByZXR1cm4gcm93O1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2hlY2tBbGwgKHZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbjtcbiAgICAgICAgICAgIHZhciBmaWx0ZXJlZENvbm5lY3Rpb25zID0gZmlsdGVyQ29ubmVjdGlvbnMoY29uZmlnKTtcbiAgICAgICAgICAgIGZpbHRlcmVkQ29ubmVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbiAoY29uZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uZWN0aW9uLmNoZWNrZWQgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3VwZGF0ZUNvbm5lY3Rpb25MaXN0ICgpIHtcbiAgICAgICAgaWYgKHNlbGYudGVtcENvbmZpZ3VyYXRpb24uY29ubmVjdGlvbnMpIHtcbiAgICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBfcmFkaW9CdXR0b25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYoX3JhZGlvQnV0dG9uc1tpXS52YWx1ZSA9PT0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5maWx0ZXJUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIF9yYWRpb0J1dHRvbnNbaV0uY2hlY2tlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKF9zZWFyY2hJbnB1dC52YWx1ZSAhPT0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5maWx0ZXJLZXkpIHtcbiAgICAgICAgICAgICAgICBfc2VhcmNoSW5wdXQudmFsdWUgPSBzZWxmLnRlbXBDb25maWd1cmF0aW9uLmZpbHRlcktleTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNlbGYudGVtcENvbmZpZ3VyYXRpb24uY29ubmVjdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgX2xpbmtzUm93LmlubmVySFRNTCA9ICc8ZGl2IGNsYXNzPVwibmctdWlfcG9wLXVwX2JvZHlfbGlua3Mtcm93X19kaXNhYmxlZFwiPkxpc3QgaXMgZW1wdHk8L2Rpdj4nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfbGlua3NSb3cuaW5uZXJIVE1MID0gJyc7XG5cbiAgICAgICAgICAgICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnRElWJyk7XG4gICAgICAgICAgICAgICAgZGl2LmNsYXNzTmFtZSA9ICduZy11aV9wb3AtdXBfYm9keV9saW5rcy1yb3dfY29udGFpbmVyJztcbiAgICAgICAgICAgICAgICBfbGlua3NSb3cuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICAgICAgICAgICAgICAgIHZhciBsaXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnVUwnKTtcbiAgICAgICAgICAgICAgICBsaXN0LmNsYXNzTmFtZSA9ICduZy11aV9wb3AtdXBfYm9keV9saW5rcy1yb3dfY29udGFpbmVyX2Nvbm5lY3Rpb24tbGlzdCc7XG4gICAgICAgICAgICAgICAgZmlsbExpc3QobGlzdCk7XG4gICAgICAgICAgICAgICAgZGl2LmFwcGVuZENoaWxkKGxpc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBfbGlua3NSb3cuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJuZy11aV9wb3AtdXBfYm9keV9saW5rcy1yb3dfX2Rpc2FibGVkXCI+TG9hZGluZy4uPC9kaXY+JztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGZpbGxMaXN0IChsaXN0Um9vdCkge1xuICAgICAgICAgICAgdmFyIGNvbmZpZyA9IHNlbGYudGVtcENvbmZpZ3VyYXRpb247XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBmaWx0ZXJlZENvbm5lY3Rpb25zID0gZmlsdGVyQ29ubmVjdGlvbnMoY29uZmlnKTtcbiAgICAgICAgICAgIGZpbHRlcmVkQ29ubmVjdGlvbnMuZm9yRWFjaChmdW5jdGlvbiAoY29ubmVjdGlvbikge1xuICAgICAgICAgICAgICAgIGxpc3RSb290LmFwcGVuZENoaWxkKGNhbGN1bGF0ZUNvbm5lY3Rpb25Sb3dzKGNvbm5lY3Rpb24pKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2FsY3VsYXRlQ29ubmVjdGlvblJvd3MgKGNvbm5lY3Rpb24pIHtcbiAgICAgICAgICAgIHZhciByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdESVYnKTtcbiAgICAgICAgICAgIHJvdy5jbGFzc05hbWUgPSAnbmctdWlfcG9wLXVwX2JvZHlfbGlua3Mtcm93X2NvbnRhaW5lcl9jb25uZWN0aW9uLWxpc3Rfcm93JztcbiAgICAgICAgICAgIHJvdy5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgY29ubmVjdGlvbi5sYWJlbCk7XG5cbiAgICAgICAgICAgIC8vIGNvbm5lY3Rpb24gY2hlY2tCb3hcbiAgICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICAgICAgdmFyIGNoZWNrQm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnSU5QVVQnKTtcbiAgICAgICAgICAgIGNoZWNrQm94LnNldEF0dHJpYnV0ZSgndHlwZScsICdjaGVja0JveCcpO1xuICAgICAgICAgICAgY2hlY2tCb3guY2hlY2tlZCA9IGNvbm5lY3Rpb24uY2hlY2tlZDtcbiAgICAgICAgICAgIGNoZWNrQm94LnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XG4gICAgICAgICAgICByb3cuYXBwZW5kQ2hpbGQoY2hlY2tCb3gpO1xuICAgICAgICAgICAgZnVuY3Rpb24gdXBkYXRlQ2hlY2tCb3hWYWx1ZSAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKGNvbm5lY3Rpb24uZGlyZWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYudGVtcENvbmZpZ3VyYXRpb24udmlzaWJpbGl0eU1hcFtjb25uZWN0aW9uLnR5cGVJZF0gPSBjaGVja0JveC5jaGVja2VkO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHNlbGYudGVtcENvbmZpZ3VyYXRpb24udmlzaWJpbGl0eU1hcFJldmVyc2VbY29ubmVjdGlvbi50eXBlSWRdID0gY2hlY2tCb3guY2hlY2tlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB1cGRhdGVDaGVja0JveFZhbHVlKCk7XG4gICAgICAgICAgICByb3cub25jbGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBjaGVja0JveC5jaGVja2VkID0gIWNoZWNrQm94LmNoZWNrZWQ7XG4gICAgICAgICAgICAgICAgY29ubmVjdGlvbi5jaGVja2VkID0gY2hlY2tCb3guY2hlY2tlZDtcbiAgICAgICAgICAgICAgICB1cGRhdGVDaGVja0JveFZhbHVlKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBJY29uXG4gICAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgICAgICAgIHZhciBpbWFnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ0lNRycpO1xuICAgICAgICAgICAgaW1hZ2UuY2xhc3NOYW1lID0gY29ubmVjdGlvbi5kaXJlY3Rpb24gPyAnbmctdWlfcG9wLXVwX2JvZHlfbGlua3Mtcm93X2NvbnRhaW5lcl9jb25uZWN0aW9uLWxpc3Rfcm93X19pbmNvbWluZy1pbWFnZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJ25nLXVpX3BvcC11cF9ib2R5X2xpbmtzLXJvd19jb250YWluZXJfY29ubmVjdGlvbi1saXN0X3Jvd19fb3V0Z29pbmctaW1hZ2UnO1xuICAgICAgICAgICAgcm93LmFwcGVuZENoaWxkKGltYWdlKTtcblxuICAgICAgICAgICAgLy8gTGFiZWxcbiAgICAgICAgICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuICAgICAgICAgICAgdmFyIGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnU1BBTicpO1xuICAgICAgICAgICAgbGFiZWwuY2xhc3NOYW1lID0gJ25nLXVpX3BvcC11cF9ib2R5X2xpbmtzLXJvd19jb250YWluZXJfY29ubmVjdGlvbi1saXN0X3Jvd19fbGFiZWwnO1xuICAgICAgICAgICAgbGFiZWwuaW5uZXJUZXh0ID0gY29ubmVjdGlvbi5sYWJlbDsgXG4gICAgICAgICAgICByb3cuYXBwZW5kQ2hpbGQobGFiZWwpO1xuXG4gICAgICAgICAgICAvLyBCdWJsZSBjb3VudGVyXG4gICAgICAgICAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbiAgICAgICAgICAgIHZhciBidWJibGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdTUEFOJyk7XG4gICAgICAgICAgICBidWJibGUuY2xhc3NOYW1lID0gJ25nLXVpX3BvcC11cF9ib2R5X2xpbmtzLXJvd19jb250YWluZXJfY29ubmVjdGlvbi1saXN0X3Jvd19fYnViYmxlJztcbiAgICAgICAgICAgIGJ1YmJsZS5pbm5lclRleHQgPSBjb25uZWN0aW9uLmNvdW50OyBcbiAgICAgICAgICAgIHJvdy5hcHBlbmRDaGlsZChidWJibGUpO1xuXG4gICAgICAgICAgICByZXR1cm4gcm93O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmlsdGVyQ29ubmVjdGlvbnMgKGNvbmZpZykge1xuICAgICAgICByZXR1cm4gc2VsZi50ZW1wQ29uZmlndXJhdGlvbi5jb25uZWN0aW9ucy5maWx0ZXIoZnVuY3Rpb24gKGNvbm5lY3Rpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAoY29uZmlnLmZpbHRlclR5cGUgPT09ICdBTEwnIHx8XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5maWx0ZXJUeXBlID09PSAnSU5DT01JTkcnICYmIGNvbm5lY3Rpb24uZGlyZWN0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy5maWx0ZXJUeXBlID09PSAnT1VUR09JTkcnICYmICFjb25uZWN0aW9uLmRpcmVjdGlvbikgJiZcbiAgICAgICAgICAgICAgICAgICAgKCFjb25maWcuZmlsdGVyS2V5IHx8IGNvbmZpZy5maWx0ZXJLZXkgJiYgY29ubmVjdGlvbi5sYWJlbC50b0xvd2VyQ2FzZSgpLmluZGV4T2YoY29uZmlnLmZpbHRlcktleS50b0xvd2VyQ2FzZSgpKSAhPT0gLTEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY3JlYXRlQ29ubmVjdGlvbnNMaXN0IChlZGdlcykge1xuICAgICAgICB2YXIgY29ubmVjdGlvbkNvdW50ZXIgPSB7fTtcbiAgICAgICAgdmFyIGNvbm5lY3Rpb25Db3VudGVyUmV2ZXJzZSA9IHt9O1xuICAgICAgICB2YXIgY29uZmlnID0gc2VsZi50ZW1wQ29uZmlndXJhdGlvbjtcblxuICAgICAgICBmdW5jdGlvbiBwdXRJbnRvTWFwIChlZGdlcywgbGFiZWwpIHtcbiAgICAgICAgICAgIGVkZ2VzLmZvckVhY2goZnVuY3Rpb24gKGVkZ2UpIHtcbiAgICAgICAgICAgICAgICB2YXIgbWFwID0gbnVsbDtcbiAgICAgICAgICAgICAgICB2YXIgY2hlY2tNYXAgPSBudWxsO1xuICAgICAgICAgICAgICAgIHZhciBkaXJlY3Rpb24gPSBfdGFyZ2V0LmRhdGFNb2RlbC50eXBlSWQgPT09IGVkZ2UudGFyZ2V0O1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChkaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwID0gY29ubmVjdGlvbkNvdW50ZXI7XG4gICAgICAgICAgICAgICAgICAgIGNoZWNrTWFwID0gY29uZmlnLnZpc2liaWxpdHlNYXA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwID0gY29ubmVjdGlvbkNvdW50ZXJSZXZlcnNlO1xuICAgICAgICAgICAgICAgICAgICBjaGVja01hcCA9IGNvbmZpZy52aXNpYmlsaXR5TWFwUmV2ZXJzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFtYXBbZWRnZS5pZF0pIHtcbiAgICAgICAgICAgICAgICAgICAgbWFwW2VkZ2UuaWRdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZUlkOiBlZGdlLmlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IGxhYmVsIHx8IGVkZ2UubGFiZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3VudDogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpcmVjdGlvbjogZGlyZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tlZDogY2hlY2tNYXBbZWRnZS5pZF0gfHwgY2hlY2tNYXBbZWRnZS5pZF0gPT09IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBtYXBbZWRnZS5pZF0uY291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBwdXRJbnRvTWFwKGVkZ2VzKTtcblxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoY29ubmVjdGlvbkNvdW50ZXIpLm1hcChmdW5jdGlvbiAoa2V5KSB7IHJldHVybiBjb25uZWN0aW9uQ291bnRlcltrZXldOyB9KS5jb25jYXQoXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhjb25uZWN0aW9uQ291bnRlclJldmVyc2UpLm1hcChmdW5jdGlvbiAoa2V5KSB7IHJldHVybiBjb25uZWN0aW9uQ291bnRlclJldmVyc2Vba2V5XTsgfSlcbiAgICAgICAgKS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICBpZiAoYS5sYWJlbCA+IGIubGFiZWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYS5sYWJlbCA8IGIubGFiZWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChhLmRpcmVjdGlvbiAmJiAhYi5kaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICghYS5kaXJlY3Rpb24gJiYgYi5kaXJlY3Rpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3JlZnJlc2ggKCkge1xuICAgICAgICBzZWxmLnRlbXBDb25maWd1cmF0aW9uID0gY2xvbmVEZWVwKF90YXJnZXQuY29uZmlndXJhdGlvblNldCk7XG4gICAgICAgIHNlbGYudGVtcENvbmZpZ3VyYXRpb24ubW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgdGFyZ2V0UG9zaXRpb24gPSBfZ2V0VGFyZ2V0UG9zaXRpb24oX3RhcmdldCk7XG4gICAgICAgIF91cGRhdGVQb3NpdGlvbih0YXJnZXRQb3NpdGlvbik7XG4gICAgICAgIF91cGRhdGVDb25uZWN0aW9uTGlzdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9nZXRUYXJnZXRQb3NpdGlvbiAoKSB7XG4gICAgICAgIGlmIChfdGFyZ2V0ICYmIF90YXJnZXQucG9zaXRpb24pIHJldHVybiBfdGFyZ2V0LnBvc2l0aW9uKCk7XG4gICAgICAgIGVsc2UgcmV0dXJuIHsgeDogMCwgeTogMCB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF91cGRhdGVQb3NpdGlvbiAocG9zaXRpb24pIHtcbiAgICAgICAgdmFyIHRhcmdldFNpemUgPSBfdGFyZ2V0LmdldCgnc2l6ZScpO1xuICAgICAgICB2YXIgcG9wVXBTaXplID0geyB3aWR0aDogX3Jvb3QuY2xpZW50V2lkdGgsIGhlaWdodDogX3Jvb3QuY2xpZW50SGVpZ2h0IH07XG4gICAgICAgIFxuICAgICAgICBpZiAoX3RhcmdldC5nZXREaXJlY3Rpb24oKSkge1xuICAgICAgICAgICAgc2V0VG9UaGVFYXN0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRUb1RoZVdlc3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNldFRvVGhlRWFzdCAoKSB7XG4gICAgICAgICAgICBfcm9vdC5zdHlsZS5sZWZ0ID0gKHBvc2l0aW9uLnggKyB0YXJnZXRTaXplLndpZHRoKSAqIF9zY3JvbGxlci5fc3ggKyAncHgnO1xuICAgICAgICAgICAgX3Jvb3Quc3R5bGUudG9wID0gKHBvc2l0aW9uLnkgKyB0YXJnZXRTaXplLmhlaWdodCAvIDIpICogX3Njcm9sbGVyLl9zeCAtIHBvcFVwU2l6ZS5oZWlnaHQgLyAyICsgJ3B4JztcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIHNldFRvVGhlV2VzdCAoKSB7XG4gICAgICAgICAgICBfcm9vdC5zdHlsZS5sZWZ0ID0gKHBvc2l0aW9uLngpICogX3Njcm9sbGVyLl9zeCAtIHBvcFVwU2l6ZS53aWR0aCArICdweCc7XG4gICAgICAgICAgICBfcm9vdC5zdHlsZS50b3AgPSAocG9zaXRpb24ueSArIHRhcmdldFNpemUuaGVpZ2h0IC8gMikgKiBfc2Nyb2xsZXIuX3N4IC0gcG9wVXBTaXplLmhlaWdodCAvIDIgKyAncHgnO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBvcFVwTWVudTtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBjbG9uZURlZXAgPSByZXF1aXJlKCdsb2Rhc2gnKS5jbG9uZURlZXA7XG5cbnZhciBERUZBVUxUX0RFQ0tfTEVOR1RIID0gNDtcblxuLyoqXG4gKiBEZXNjcmlwdGlvblxuICogXG4gKiBDb25zdHJ1Y3RvciBwYXJhbWV0ZXJzXG4gKiAgQHBhcmFtIHtHcmFwaExheW91dH0gbGF5b3V0XG4gKiAgQHBhcmFtIHtPYmplY3R9IHBhcmFtZXRlcnNcblxuICogUHVibGljIG1ldGhvZHM6XG4gKiBwdXNoU3RhdGUgKCk6IHZvaWRcbiAqIGdldEhpc3Rvcnk6IHtcbiAqICBzdGF0ZXM6IFtdLFxuICogIGN1cnJlbnRJbmRleDogbnVtYmVyLFxuICogfVxuICogdW5kb1N0YXRlICgpOiB2b2lkXG4gKiByZWRvU3RhdGUgKCk6IHZvaWRcbiAqL1xuZnVuY3Rpb24gU3RhdGVTdG9yYWdlIChsYXlvdXQsIHBhcmFtZXRlcnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFwYXJhbWV0ZXJzKSBwYXJhbWV0ZXJzID0ge307XG5cbiAgICB2YXIgX2xheW91dCA9IGxheW91dDtcbiAgICB2YXIgX3N0YXRlRGVjayA9IFtdO1xuICAgIHZhciBfc3RhdGVNYXAgPSB7fTtcbiAgICB2YXIgX2RlY2tMZW5ndGggPSBwYXJhbWV0ZXJzLmRlY2tMZW5ndGggfHwgREVGQVVMVF9ERUNLX0xFTkdUSDtcbiAgICB2YXIgX2N1cnJlbnRJbmRleCA9IC0xO1xuXG4gICAgc2VsZi5wdXNoU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChfc3RhdGVEZWNrLmxlbmd0aCAtIDEgPiBfY3VycmVudEluZGV4KSB7XG4gICAgICAgICAgICBfc3RhdGVEZWNrLnNwbGljZShfY3VycmVudEluZGV4ICsgMSwgX3N0YXRlRGVjay5sZW5ndGgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfc2F2ZVN0YXRlKCkpIHtcbiAgICAgICAgICAgIF9jaGVjaygpO1xuICAgICAgICAgICAgX2N1cnJlbnRJbmRleCA9IF9zdGF0ZURlY2subGVuZ3RoO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHNlbGYuZ2V0SGlzdG9yeSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXRlczogY2xvbmVEZWVwKF9zdGF0ZURlY2spLFxuICAgICAgICAgICAgY3VycmVudEluZGV4OiBfY3VycmVudEluZGV4LFxuICAgICAgICB9O1xuICAgIH07XG5cbiAgICBzZWxmLnVuZG9TdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKF9jdXJyZW50SW5kZXggPT09IF9zdGF0ZURlY2subGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoX3NhdmVTdGF0ZSgpKSB7XG4gICAgICAgICAgICAgICAgX2NoZWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfdXBkYXRlTWFwKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKF9jdXJyZW50SW5kZXggPiAwKSB7XG4gICAgICAgICAgICBfY3VycmVudEluZGV4LS07XG4gICAgICAgICAgICByZXR1cm4gX3JldHVyblN0YXRlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBzZWxmLnJlZG9TdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3VwZGF0ZU1hcCgpO1xuICAgICAgICBpZiAoX2N1cnJlbnRJbmRleCArIDEgPCBfc3RhdGVEZWNrLmxlbmd0aCkge1xuICAgICAgICAgICAgX2N1cnJlbnRJbmRleCsrO1xuICAgICAgICAgICAgcmV0dXJuIF9yZXR1cm5TdGF0ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGZ1bmN0aW9uIF9yZXR1cm5TdGF0ZSAoKSB7XG4gICAgICAgIHJldHVybiBfc3RhdGVNYXBbX3N0YXRlRGVja1tfY3VycmVudEluZGV4XV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gX3NhdmVTdGF0ZSAoKSB7XG4gICAgICAgIHZhciBzdGF0ZSA9IF9sYXlvdXQuZ2V0U3RhdGUoKTtcbiAgICAgICAgaWYgKHN0YXRlLnJvb3ROb2RlKSB7XG4gICAgICAgICAgICBfc3RhdGVNYXBbc3RhdGUucm9vdE5vZGUudHlwZUlkXSA9IHN0YXRlO1xuXG4gICAgICAgICAgICBpZiAoX3N0YXRlRGVja1tfc3RhdGVEZWNrLmxlbmd0aCAtIDFdICE9PSBzdGF0ZS5yb290Tm9kZS50eXBlSWQpIF9zdGF0ZURlY2sucHVzaChzdGF0ZS5yb290Tm9kZS50eXBlSWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfdXBkYXRlTWFwICgpIHtcbiAgICAgICAgdmFyIHN0YXRlID0gX2xheW91dC5nZXRTdGF0ZSgpO1xuICAgICAgICBpZiAoc3RhdGUucm9vdE5vZGUpIHtcbiAgICAgICAgICAgIF9zdGF0ZU1hcFtzdGF0ZS5yb290Tm9kZS50eXBlSWRdID0gc3RhdGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY2hlY2sgKCkge1xuICAgICAgICBpZiAoX3N0YXRlRGVjay5sZW5ndGggPiBfZGVja0xlbmd0aCkgX3N0YXRlRGVjay5zaGlmdCgpO1xuXG4gICAgICAgIE9iamVjdC5rZXlzKF9zdGF0ZU1hcCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICBpZiAoX3N0YXRlRGVjay5pbmRleE9mKGtleSkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgaWYoIWRlbGV0ZSBfc3RhdGVNYXBba2V5XSkge1xuICAgICAgICAgICAgICAgICAgICBfc3RhdGVNYXBba2V5XSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZVN0b3JhZ2U7XG5cbiIsInZhciBfID0gcmVxdWlyZSgnbG9kYXNoJyk7XG5cbi8qKiBcbiAqIEl0J3MgYmFzZSBjbGFzcyB3aGljaCBwcm92aWRlcyBzdWJzY3JpcHRpb24gQVBJIGZvciBzdWNjZXNzb3JzLlxuICogQGNsYXNzXG4qL1xuXG5mdW5jdGlvbiBTdWJzY3JpYmFibGUgKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9zdWJzY3JpYnRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBNZXRob2QgYWxsb3dzIHRvIHN1YnNjcmliZSBvbiBhIHNvbWUgc3BlY2lmaWMgZXZlbnQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IC0gZXZlbnQgaWRcbiAgICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFjayAtIGV2ZW50IGhhbmRsZXJcbiAgICAgKiBAbWVtYmVyb2YgU3Vic2NyaWJhYmxlXG4gICAgICogQG1ldGhvZFxuICAgICovXG4gICAgc2VsZi5vbiA9IGZ1bmN0aW9uIChldmVudCwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFzZWxmLl9zdWJzY3JpYnRpb25zW2V2ZW50XSkgc2VsZi5fc3Vic2NyaWJ0aW9uc1tldmVudF0gPSBbXTtcbiAgICAgICAgc2VsZi5fc3Vic2NyaWJ0aW9uc1tldmVudF0ucHVzaChjYWxsYmFjayk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1ldGhvZCBhbGxvd3MgdG8gdW5zdWJzY3JpYmUgZnJvbSBhIHNvbWUgc3BlY2lmaWMgZXZlbnQuXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgLSBldmVudCBoYW5kbGVyXG4gICAgICogQG1lbWJlcm9mIFN1YnNjcmliYWJsZVxuICAgICAqIEBtZXRob2RcbiAgICAqL1xuICAgIHNlbGYudW5zdWJzY3JpYmUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgXy52YWx1ZXMoc2VsZi5fc3Vic2NyaWJ0aW9ucykuZm9yRWFjaChmdW5jdGlvbiAoc3Vic2NyaWJlcnMpIHtcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHN1YnNjcmliZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkgc3Vic2NyaWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1ldGhvZCB3aGljaCBmaXJlcyB0aGUgZXZlbnQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50IC0gZXZlbnQgaWRcbiAgICAgKiBAcGFyYW0ge09iamVjdFtdfSBwYXJhbWV0ZXJzXG4gICAgICogQG1lbWJlcm9mIFN1YnNjcmliYWJsZVxuICAgICAqIEBtZXRob2RcbiAgICAqL1xuICAgIHNlbGYudHJpZ2dlciA9IGZ1bmN0aW9uIChldmVudCwgcGFyYW1ldGVycykge1xuICAgICAgICBpZiAoIShwYXJhbWV0ZXJzIGluc3RhbmNlb2YgQXJyYXkpKSBwYXJhbWV0ZXJzID0gW3BhcmFtZXRlcnNdO1xuICAgICAgICBpZiAoc2VsZi5fc3Vic2NyaWJ0aW9ucyAmJiBzZWxmLl9zdWJzY3JpYnRpb25zW2V2ZW50XSkge1xuICAgICAgICAgICAgc2VsZi5fc3Vic2NyaWJ0aW9uc1tldmVudF0uZm9yRWFjaChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgICAgIGMuYXBwbHkodGhpcywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XG5tb2R1bGUuZXhwb3J0cyA9IFN1YnNjcmliYWJsZTtcbiJdfQ==
