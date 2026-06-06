'use strict'
// copied from https://github.com/capaj/localstorage-polyfill
// needed by @tidal-music/auth
const valuesMap = new Map()

class LocalStorage {
  init() {
    // dummy
  }
  getItem (key: string) {
    const stringKey = String(key)
    if (valuesMap.has(key)) {
      return String(valuesMap.get(stringKey))
    }
    return null
  }

  setItem (key: string, val: string) {
    valuesMap.set(String(key), String(val))
  }

  removeItem (key: string) {
    valuesMap.delete(key)
  }

  clear () {
    valuesMap.clear()
  }

  key (i: number) {
    if (arguments.length === 0) {
      throw new TypeError("Failed to execute 'key' on 'Storage': 1 argument required, but only 0 present.") // this is a TypeError implemented on Chrome, Firefox throws Not enough arguments to Storage.key.
    }
    var arr = Array.from(valuesMap.keys())
    return arr[i]
  }

  get length () {
    return valuesMap.size
  }
}
const instance = new LocalStorage()

const localStorage = new Proxy(instance, {
  set: function (obj, prop: string, value: string) {
    if (LocalStorage.prototype.hasOwnProperty(prop)) {
      ;(instance as any)[prop] = value
    } else {
      instance.setItem(prop, value)
    }
    return true
  },
  get: function (target, name: string) {
    if (LocalStorage.prototype.hasOwnProperty(name)) {
      return (instance as any)[name]
    }
    if (valuesMap.has(name)) {
      return instance.getItem(name)
    }
  }
})

global.localStorage = localStorage

export {
  localStorage
}