// 通用变量
window.SERVICE_VERSION = 'version001' // 后端服务版本号

window.getEnvObject = function() {

  const protocol = window.location.protocol
  let hostname = window.location.hostname
  if (hostname === 'localhost') {
    hostname = '10.75.17.41'
  }
  const urlPrefix = protocol + '//' + hostname

  return {
    // 本地环境
    BASE_URL: '/', // 后端网关|nginx前缀
    PORTAL_URL: urlPrefix + ':8010', // portal地址
  }
}
