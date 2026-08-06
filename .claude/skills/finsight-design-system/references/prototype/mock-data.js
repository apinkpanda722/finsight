window.FINSIGHT_DATA = (function(){
  function won(n){ return n.toLocaleString('ko-KR') + '원'; }

  var accounts = [
    { id:'acc1', bank:'신한카드', type:'카드', last4:'4821', locked:false },
    { id:'acc2', bank:'국민은행', type:'입출금', last4:'0192', locked:true },
    { id:'acc3', bank:'카카오뱅크', type:'입출금', last4:'7734', locked:true },
  ];

  var categories = [
    { key:'food', label:'식비', amount:482000 },
    { key:'shopping', label:'쇼핑', amount:215000 },
    { key:'transit', label:'교통', amount:96000 },
    { key:'subscription', label:'구독', amount:58000 },
    { key:'cafe', label:'카페', amount:63000 },
    { key:'medical', label:'의료', amount:40000 },
    { key:'etc', label:'기타', amount:77000 },
  ];

  var monthly = [
    { month:'2026-03', label:'3월', total:892000, locked:true },
    { month:'2026-04', label:'4월', total:945000, locked:true },
    { month:'2026-05', label:'5월', total:998000, locked:true },
    { month:'2026-06', label:'6월', total:1102000, locked:false },
    { month:'2026-07', label:'7월', total:968000, locked:false },
    { month:'2026-08', label:'8월', total:1031000, locked:false, current:true },
  ];

  var statements = [
    { id:'st1', accountId:'acc1', filename:'신한카드_2026-08.csv', uploadedAt:'2026-08-05', period:'2026-08', rows:142, status:'completed' },
    { id:'st2', accountId:'acc1', filename:'신한카드_2026-07.csv', uploadedAt:'2026-07-31', period:'2026-07', rows:156, status:'completed' },
    { id:'st3', accountId:'acc1', filename:'신한카드_2026-06.csv', uploadedAt:'2026-07-02', period:'2026-06', rows:149, status:'completed' },
    { id:'st4', accountId:'acc1', filename:'신한카드_2026-05.csv', uploadedAt:'2026-06-01', period:'2026-05', rows:151, status:'completed' },
    { id:'st5', accountId:'acc1', filename:'신한카드_2026-07b.csv', uploadedAt:'2026-08-01', period:'2026-07', rows:0, status:'failed' },
    { id:'st6', accountId:'acc1', filename:'신한카드_2026-06b.csv', uploadedAt:'2026-08-02', period:'2026-06', rows:0, status:'processing' },
  ];

  return { won, accounts, categories, monthly, statements };
})();
