const {chromium}=require('playwright');const {spawn}=require('child_process');const path=require('path');
(async()=>{
 const mode=process.argv[2]||'stills';
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1080,height:1920}});
 pg.on('console',m=>console.log('PAGE',m.text()));pg.on('pageerror',e=>console.log('ERR',e.message));
 await pg.goto('file://'+path.resolve('video.html'));await pg.evaluate(()=>window.ready);
 const B=await pg.evaluate(()=>window.B), D=await pg.evaluate(()=>window.DURATION);
 const grab=async t=>{const d=await pg.evaluate(t=>{draw(t);return document.getElementById('cv').toDataURL('image/jpeg',0.94)},t);return Buffer.from(d.split(',')[1],'base64')};
 if(mode==='stills'){const fs=require('fs');fs.mkdirSync('stills',{recursive:true});
   const beats=(process.argv[3]||'2.9,4.3,8.6,11.2,14.5,19,21,26.8,29.1,31,33,35.5,37,39,42,46').split(',').map(Number);
   for(const bb of beats){fs.writeFileSync(`stills/b${String(bb).padStart(5,'0')}.jpg`,await grab(bb*B))}
 }else{const fps=30,N=Math.ceil(D*fps);
   const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','video_noaudio.mp4'],{stdio:['pipe','inherit','inherit']});
   for(let i=0;i<N;i++){const buf=await grab(i/fps);if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%100==0)console.log('frame',i,'/',N)}
   ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('done',N,'frames',D.toFixed(2),'s')}
 await b.close()})();
