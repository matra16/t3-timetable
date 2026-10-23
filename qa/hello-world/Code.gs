function doGet() {
  const html = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f0f6f8;color:#142d46;font-family:Arial,sans-serif}' +
    'main{max-width:550px;width:calc(100% - 80px);background:white;border:1px solid #dbe6ea;border-radius:22px;padding:40px;box-shadow:0 15px 45px #123b541c}' +
    'h1{font-size:56px;margin:18px 0;color:#087b77}p{font-size:18px;line-height:1.6}small{color:#607286}span{letter-spacing:2px;font-size:12px;font-weight:700}' +
    '</style></head><body><main><span>T3 TIMETABLE OS | RELEASE PIPELINE TEST</span>' +
    '<h1>Hello World!</h1><p>Public Production Deployment - Live GAS Demo</p>' +
    '<small>DEMO ONLY - No school, teacher or student data.</small></main></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('T3TT Hello World Demo');
}
