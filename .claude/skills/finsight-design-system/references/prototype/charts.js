window.FinsightCharts = (function(){
  function donutGradient(data, colors){
    const total = data.reduce((s,d)=>s+d,0);
    let acc = 0;
    const segs = data.map((d,i)=>{
      const start = acc/total*360; acc += d; const end = acc/total*360;
      return colors[i%colors.length] + ' ' + start.toFixed(1) + 'deg ' + end.toFixed(1) + 'deg';
    });
    return 'conic-gradient(' + segs.join(',') + ')';
  }
  function linePoints(values, w, h, pad){
    pad = pad || 6;
    const min = Math.min(...values), max = Math.max(...values);
    const n = values.length;
    return values.map((v,i)=>{
      const x = pad + i*(w-2*pad)/(n-1);
      const y = h - pad - ((v-min)/((max-min)||1))*(h-2*pad);
      return x.toFixed(1)+','+y.toFixed(1);
    });
  }
  function areaPath(values, w, h, pad){
    const pts = linePoints(values, w, h, pad);
    const first = pts[0].split(',')[0];
    const last = pts[pts.length-1].split(',')[0];
    return 'M'+first+','+(h-(pad||6))+' L'+pts.join(' L')+' L'+last+','+(h-(pad||6))+' Z';
  }
  return { donutGradient, linePoints, areaPath };
})();
