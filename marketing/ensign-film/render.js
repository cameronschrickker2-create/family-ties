const { chromium } = require('playwright'); const { spawn } = require('child_process');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8780/film.html');await p.evaluate(()=>window.ready);
const END=await p.evaluate(()=>END), FPS=24, N=Math.round(END*FPS);
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','24','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','video_silent.mp4'],{stdio:['pipe','inherit','inherit']});
for(let i=0;i<N;i++){ const d=await p.evaluate(t=>draw(t).then(()=>document.getElementById('c').toDataURL('image/jpeg',.94)),i/FPS);
  if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64'))) await new Promise(r=>ff.stdin.once('drain',r));
  if(i%120===0) console.log('frame',i,'/',N);}
ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close(); console.log('done');})();
