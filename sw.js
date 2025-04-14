// serviceWorker
self.version = '001'
self.cacheName = 'dev-page-caches'
// 匹配方法
function match (rule, request) {
  switch (Object.prototype.toString.call(rule)) {
    // url 文本匹配
    case '[object String]':
      // 使用 URL() 将匹配规则传入的路径补全
      return request.url === new URL(rule, location).href
    // url 正则匹配
    case '[object RegExp]':
      return request.url.match(rule) && !request.url.endsWith('sw.js')
    // 支持自定义匹配
    case '[object Function]':
      return rule(request)
  }
}

// 响应方法
function respond (event, handler) {
  try {
    // 执行响应处理方法，根据返回结果进行兜底
    let res = handler(event.request)
    // 异步的响应结果兜底
    if (res instanceof Promise) {
      let promise = res.then(response => {
        // 如果返回结果非 Response 对象，抛出错误
        if (!(response instanceof Response)) {
          throw Error('返回结果异常')
        }
        return response
      })
        // 异步响应错误处理，即直接返回状态码为 500 Response 对象
        .catch(() => new Response('Service Worker 出错', {status: 500}))
      event.respondWith(promise)
      return
    }
    // 同步响应如果出现任何错误
    // 可以选择不调用 event.respondWith(r)
    // 让资源请求继续走浏览器默认的请求流程
    if (res instanceof Response) {
      event.respondWith(res)
    }
  } catch (e) {}
}

// 缓存路由注册
class Router {
  constructor () {
    // 存放路由规则
    this.routes = []
    // 注册 fetch 事件拦截
    this.initProxy()
  }
  initProxy () {
    self.addEventListener('fetch', event => {
      // 当拦截到资源请求时，会遍历已注册的路由规则，并执行相应规则所对应的策略
      for (let route of this.routes) {
        // 使用前面封装好的 match 函数进行路由规则匹配
        if (match(route.rule, event.request)) {
          // 使用前面封装好的 respond 方法执行回调操作
          respond(event, route.handler)
          break
        }
      }
    })
  }
  registerRoute (rule, handler) {
    this.routes.push({rule, handler})
  }
}

self.addEventListener('install', () => {
  caches.delete(self.cacheName)
  // 安装回调的逻辑处理
  console.log('service worker 安装成功')
  // 跳过等待
  self.skipWaiting()
})
// self.addEventListener('fetch', event => {
//   console.log('service worker 抓取请求成功: ' + event.request.url)
//   // event.respondWith(new Response('Hello World!'))
//   // event.respondWith(new Promise(resolve => {
//   //   setTimeout(() => {
//   //     resolve(new Response('Hello World!'))
//   //   }, 1000)
//   // }))
// })

const router = new Router()

// 统一策略函数格式
function strategyFactory(cacheName, matchOptions, fetchOptions) {
  // 往缓存中写入资源
  const cacheResponse = async (request, response) => {
    // 使用 cacheName 参数打开缓存
    let cache = await caches.open(cacheName)
    let key = request.url
    if (request.url.includes('#') || request.url.includes('?')) {
      key = request.url.split(/#|\?/)[0]
    }
    await cache.put(key, response)
  }
  // 缓存中查找资源并返回
  const getCachedResponse = async request => {
    let cache = await caches.open(cacheName)
    let key = request.url
    if (request.url.includes('#') || request.url.includes('?')) {
      key = request.url.split(/#|\?/)[0]
    }
    return cache.match(key, matchOptions)
  }

  // 发起网络请求，并且把成功响应的对象存入缓存中
  const fetchAndCatch = async request => {
    let response = await fetch(request.clone(), fetchOptions)
    // 请求资源失败时直接返回
    if (!response.ok) {
      return response
    }
    // 网络请求成功后，将请求响应结果复制一份存入缓存中
    // 更新缓存过程无需阻塞函数执行
    cacheResponse(request, response.clone())
      // 同时缓存更新行为只需静默执行即可
      .catch(() => {})
    // 返回响应结果
    return response
  }

  return async request => {
    let response
    try {
      // 优先匹配本地缓存
      response = await getCachedResponse(request)
    } catch (e) {}
    // 匹配不到缓存或者缓存读取出现异常时，再去发起网络请求
    // 并且将请求成功的资源写入缓存中
    if (response == null) {
      response = await fetchAndCatch(request)
    }
    return response
  }
}
self.addEventListener('activate', () => {
  // 激活回调的逻辑处理
  console.log('service worker 激活成功')
})
router.registerRoute(({ url }) => {
  const urlObj = new URL(url)
  return urlObj.pathname === '/' || urlObj.pathname === '/index.html'
}, strategyFactory(self.cacheName))
router.registerRoute(/\.(css|js)$/, strategyFactory(self.cacheName))
router.registerRoute(/\.(jpe?g|png|svg|ico)$/, strategyFactory(self.cacheName))
