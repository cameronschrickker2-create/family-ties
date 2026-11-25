import numpy as np
from scipy.signal import butter,sosfilt,fftconvolve
from scipy.io import wavfile
SR=44100;BPM=112;B=60/BPM;BEATS=48;TAIL=2.5
N=int((BEATS*B+TAIL)*SR);r=np.random.default_rng(3)
def z():return np.zeros((N,2))
def at(b):return int(b*B*SR)
def add(bus,sig,b,gain=1.0,pan=0.0):
    i=at(b) if not isinstance(b,int) else b
    if i>=N:return
    s=sig[:N-i]
    if s.ndim==1:
        l=np.cos((pan+1)*np.pi/4);rr=np.sin((pan+1)*np.pi/4);bus[i:i+len(s),0]+=s*gain*l*1.41;bus[i:i+len(s),1]+=s*gain*rr*1.41
    else:bus[i:i+len(s)]+=s*gain
def filt(x,kind,f,o=2):return sosfilt(butter(o,f,kind,fs=SR,output='sos'),x,axis=0)
def T(d):return np.arange(int(d*SR))/SR
def nt(n):return 440*2**((n-69)/12)
# ---- instruments
def kick():
    t=T(.45);f=48+110*np.exp(-t*28);ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(1.6*np.sin(ph)*np.exp(-t*6.5))+0.25*np.exp(-t*300)*r.standard_normal(len(t))*0.3
def logdrum(f0,d=.55):
    t=T(d);f=f0*(1+0.9*np.exp(-t*35));ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)+0.35*np.sin(2*ph)+0.12*np.sin(3*ph);env=np.exp(-t*5.5)*(1-np.exp(-t*400))
    return np.tanh(2.2*s*env)*0.8
def shaker(acc):
    t=T(.07);n=filt(r.standard_normal(len(t)),'highpass',6500);return n*np.exp(-t*(55 if acc else 90))*(0.5 if acc else 0.28)
def clap():
    t=T(.35);n=filt(r.standard_normal(len(t)),'bandpass',[900,3200]);env=np.exp(-t*22)
    for d in (0.008,0.017):k=int(d*SR);env[:k]+=0  # flams
    e2=np.zeros_like(t);[e2.__setitem__(slice(int(d*SR),None),e2[int(d*SR):]+np.exp(-(t[:len(t)-int(d*SR)])*60)) for d in (0,.011,.022)]
    rim=np.sin(2*np.pi*1750*t)*np.exp(-t*90)*0.4
    return n*(0.6*env+0.5*e2)*0.55+rim
def rhodes(notes,d):
    t=T(d);out=np.zeros((len(t),2))
    for n in notes:
        f=nt(n)
        for ch,det in ((0,-1.6),(1,1.6)):
            ff=f*2**(det/1200);s=np.sin(2*np.pi*ff*t)+0.25*np.sin(4*np.pi*ff*t)*np.exp(-t*3)+0.08*np.sin(6*np.pi*ff*t)*np.exp(-t*6)
            out[:,ch]+=s
    env=(1-np.exp(-t*30))*np.exp(-t*0.55)*(1+0.18*np.sin(2*np.pi*4.2*t))
    rel=np.minimum(1,(d-t)/0.08);return out*(env*rel)[:,None]*0.07
def noise_riser(d,up=True):
    t=T(d);n=r.standard_normal((len(t),2));x=t/d if up else 1-t/d
    lo=filt(n,'lowpass',800);hi=filt(n,'highpass',3000)
    return (lo*(1-x)[:,None]+hi*x[:,None])*(x**2.2)[:,None]*0.35
def impact():
    t=T(2.2);f=70*np.exp(-t*1.2)+28;ph=2*np.pi*np.cumsum(f)/SR
    sub=np.sin(ph)*np.exp(-t*1.6);n=filt(r.standard_normal(len(t)),'lowpass',2500)*np.exp(-t*7)*0.5
    return np.tanh(1.4*(sub+n))
def whoosh(d=.9):
    t=T(d);n=r.standard_normal((len(t),2));x=np.sin(np.pi*t/d)**2
    a=filt(n,'bandpass',[300,1400]);b=filt(n,'bandpass',[1800,6000]);m=t/d
    return (a*(1-m)[:,None]+b*m[:,None])*x[:,None]*0.5
def tick():
    t=T(.03);return np.sin(2*np.pi*2400*t)*np.exp(-t*260)*0.25+filt(r.standard_normal(len(t)),'highpass',4000)*np.exp(-t*300)*0.15
# ---- arrangement
drums=z();bass=z();keys=z();fx=z();verb=z()
CH=[[57,60,64,67,71],[53,57,60,64],[50,53,57,60,64],[52,55,59,62,67]]  # Am9 Fmaj7 Dm9 Em7
ROOT=[45,41,38,40]
def active(b):return not(11.5<=b<12)
kicks=[]
for bar in range(12):
    b0=bar*4;ch=bar%4
    if b0<44: add(keys,rhodes(CH[ch],4*B+.05),b0,1.0 if b0>=4 else 0.8)
    else: add(keys,rhodes(CH[0],4*B+2.4),b0,1.1)
    for s in range(16):
        b=b0+s/4;
        if not active(b) or b>=44: continue
        sw=0.035 if s%2 else 0   # swing
        if s%4==0 and 4<=b<44 and not(36<=b<36.5): add(drums,kick(),b,0.95);kicks.append(b)
        if 4<=b<44: add(drums,shaker(s%4==2),b+sw,1.0,0.25 if s%2 else -0.15)
        if s in(4,12) and 12<=b<44: c=clap();add(drums,c,b,0.8);add(verb,c,b,0.5)
        if b>=12 and b<44 and s in(0,3,6,10,12,14):
            n=ROOT[ch]+(12 if s==14 else 0)+(7 if s==10 else 0);add(bass,logdrum(nt(n)),b,0.85)
        if 8<=b<11.5 and s in(0,6,10): add(bass,logdrum(nt(ROOT[ch])),b,0.7)
add(bass,logdrum(nt(45),1.6),44,1.0)
# typing ticks in intro
for k in range(26): add(fx,tick(),0.15+k*(1.85/26)+r.uniform(-.01,.01),0.8,r.uniform(-.3,.3))
for b,d in ((2,2*B),(9.5,2*B),(34,2*B)): add(fx,noise_riser(d),b,0.9 if b!=9.5 else 1.1)
for b in (4,12,36): add(fx,impact(),b,0.9);add(verb,impact()*0.4,b,0.4)
add(fx,impact(),44,0.5)
for b in (20,28): add(fx,whoosh(),b-0.85,1.0)
for b in (12,36): add(fx,whoosh(.5)*1.4,b-0.55,1.0)
# intro keys lowpass sweep
k0=at(4);keys[:k0]=filt(keys[:k0],'lowpass',700)
# sidechain
sc=np.ones(N)
for b in kicks:
    i=at(b);L=min(int(.3*SR),N-i);tt=np.arange(L)/SR;sc[i:i+L]=np.minimum(sc[i:i+L],1-0.55*np.exp(-tt*14))
keys*=sc[:,None];bass*=(0.6+0.4*sc)[:,None]
# reverb send
ir_t=T(1.6);ir=np.stack([r.standard_normal(len(ir_t))*np.exp(-ir_t*3.2) for _ in range(2)],1);ir=filt(ir,'lowpass',5000)
wet=np.stack([fftconvolve(verb[:,c]+keys[:,c]*0.6,ir[:,c])[:N] for c in range(2)],1)*0.05

mix=drums*0.85+bass*0.8+keys*1.3+fx*0.55+wet
# hard gap
g0,g1=at(11.5),at(12);mix[g0:g1]*=np.linspace(1,0,g1-g0)[:,None]**8
mix=filt(mix,'highpass',28)
mix=np.tanh(mix*0.55)
fade=at(47);mix[fade:]*=np.linspace(1,0,N-fade)[:,None]**1.5
mix/=np.abs(mix).max()/0.89
wavfile.write('music.wav',SR,(mix*32767).astype(np.int16));print('ok',N/SR)
