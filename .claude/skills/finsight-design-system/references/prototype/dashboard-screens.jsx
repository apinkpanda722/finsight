const { Button, Input, Badge } = window.FinsightDesignSystem_c404e7;
const D = window.FINSIGHT_DATA;

function PlanBadge({ plan }) {
  const pro = plan === 'pro';
  return (<span style={{
    font:'var(--text-caption-strong)',textTransform:'uppercase',letterSpacing:'0.02em',
    borderRadius:'var(--radius-pill)',padding:'4px 12px',display:'inline-block',
    background: pro ? 'var(--color-primary)' : 'var(--color-surface-strong)',
    color: pro ? 'var(--color-on-primary)' : 'var(--color-ink)',
  }}>{pro ? 'Pro' : 'Free'}</span>);
}

const STATUS_LABEL = { uploading:'업로드 중', pending:'대기 중', processing:'분석 중', completed:'완료', failed:'실패' };
const STATUS_COLOR = { uploading:'var(--color-muted)', pending:'var(--color-muted)', processing:'var(--color-primary)', completed:'var(--color-semantic-up)', failed:'var(--color-semantic-down)' };

function StatusBadge({ status }) {
  return (<span style={{font:'var(--text-caption-strong)',color:STATUS_COLOR[status],display:'inline-flex',alignItems:'center',gap:6}}>
    <span style={{width:6,height:6,borderRadius:'50%',background:STATUS_COLOR[status]}}></span>{STATUS_LABEL[status]}
  </span>);
}

function Sidebar({ active, setActive, plan }) {
  const items = [
    { key:'overview', label:'개요' },
    { key:'statements', label:'명세서 관리' },
    { key:'billing', label:'요금제' },
  ];
  return (<div style={{width:220,background:'var(--color-canvas)',borderRight:'1px solid var(--color-hairline)',padding:'24px 16px',display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 8px 24px'}}>
      <span style={{font:'600 18px var(--font-display)'}}>finsight</span>
      <PlanBadge plan={plan}/>
    </div>
    {items.map(it=>(
      <div key={it.key} onClick={()=>setActive(it.key)} style={{
        padding:'10px 12px',borderRadius:'var(--radius-sm)',cursor:'pointer',
        font:active===it.key?'var(--text-title-sm)':'var(--text-body-md)',
        background:active===it.key?'var(--color-surface-strong)':'transparent',color:'var(--color-ink)',
      }}>{it.label}</div>
    ))}
  </div>);
}

function AccountChips({ accounts, activeId, setActiveId, plan, onLockedClick }) {
  return (<div style={{display:'flex',gap:8,marginBottom:24,flexWrap:'wrap'}}>
    {accounts.map(a=>{
      const locked = a.locked && plan !== 'pro';
      const isActive = activeId === a.id;
      return (<div key={a.id} onClick={()=>locked ? onLockedClick() : setActiveId(a.id)} style={{
        padding:'8px 16px',borderRadius:'var(--radius-pill)',cursor:'pointer',display:'flex',alignItems:'center',gap:8,
        background:isActive?'var(--color-ink)':'var(--color-surface-strong)',
        color:isActive?'var(--color-on-dark)':'var(--color-ink)',
        opacity:locked?0.55:1,
        font:'var(--text-body-sm)',
      }}>{a.bank} {a.type} ({a.last4}){locked ? ' 🔒' : ''}</div>);
    })}
  </div>);
}

function CategoryBar({ label, amount, max }) {
  const pct = Math.round((amount/max)*100);
  return (<div style={{marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
      <span style={{font:'var(--text-body-md)'}}>{label}</span>
      <span style={{font:'var(--text-number-display)'}}>{D.won(amount)}</span>
    </div>
    <div style={{height:8,borderRadius:'var(--radius-pill)',background:'var(--color-surface-strong)',overflow:'hidden'}}>
      <div style={{height:'100%',width:pct+'%',background:'var(--color-primary)',borderRadius:'var(--radius-pill)'}}></div>
    </div>
  </div>);
}

function MonthlyTrend({ months, plan, onUpgrade }) {
  const max = Math.max(...months.map(m=>m.total));
  return (<div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:24}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
      <div style={{font:'var(--text-title-lg)'}}>월별 추이</div>
      {plan !== 'pro' ? <span style={{font:'var(--text-caption)',color:'var(--color-muted)'}}>현재 달 포함 최근 3개월만 표시됩니다</span> : null}
    </div>
    <div style={{display:'flex',alignItems:'flex-end',gap:16,height:180}}>
      {months.map(m=>{
        const locked = m.locked && plan !== 'pro';
        const h = Math.max(8, Math.round((m.total/max)*150));
        return (<div key={m.month} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:locked?'pointer':'default'}} onClick={()=>locked && onUpgrade()}>
          <div style={{width:'100%',display:'flex',alignItems:'flex-end',justifyContent:'center',height:150}}>
            <div style={{width:'60%',height:h,borderRadius:'6px 6px 0 0',background:locked?'var(--color-hairline)':(m.current?'var(--color-primary)':'var(--color-surface-dark-elevated)'),position:'relative'}}>
              {locked ? <div style={{position:'absolute',top:-22,left:'50%',transform:'translateX(-50%)',font:'12px var(--font-body)',color:'var(--color-muted)'}}>🔒</div> : null}
            </div>
          </div>
          <div style={{font:'var(--text-caption)',color:'var(--color-muted)'}}>{m.label}</div>
        </div>);
      })}
    </div>
  </div>);
}

function Overview({ plan, onUpgrade }) {
  const [activeAccount, setActiveAccount] = React.useState('acc1');
  const maxCat = Math.max(...D.categories.map(c=>c.amount));
  const total = D.categories.reduce((s,c)=>s+c.amount,0);
  return (<div>
    <AccountChips accounts={D.accounts} activeId={activeAccount} setActiveId={setActiveAccount} plan={plan} onLockedClick={onUpgrade}/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:24}}>
      <div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:24}}>
        <div style={{font:'var(--text-caption)',color:'var(--color-muted)',marginBottom:8}}>이번 달 총 지출</div>
        <div style={{font:'var(--text-display-sm)'}}>{D.won(total)}</div>
      </div>
      <div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:24}}>
        <div style={{font:'var(--text-caption)',color:'var(--color-muted)',marginBottom:8}}>전월 대비</div>
        <div style={{font:'var(--text-display-sm)',color:'var(--color-semantic-up)'}}>+6.5%</div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:24}}>
        <div style={{font:'var(--text-title-lg)',marginBottom:20}}>카테고리별 지출</div>
        {D.categories.slice().sort((a,b)=>b.amount-a.amount).map(c=><CategoryBar key={c.key} label={c.label} amount={c.amount} max={maxCat}/>)}
      </div>
      <MonthlyTrend months={D.monthly} plan={plan} onUpgrade={onUpgrade}/>
    </div>
  </div>);
}

function ConfirmDelete({ onCancel, onConfirm }) {
  return (<span style={{display:'inline-flex',gap:8,alignItems:'center'}}>
    <span style={{font:'var(--text-caption)',color:'var(--color-body)'}}>삭제할까요?</span>
    <span onClick={onConfirm} style={{font:'var(--text-caption-strong)',color:'var(--color-semantic-down)',cursor:'pointer'}}>삭제</span>
    <span onClick={onCancel} style={{font:'var(--text-caption-strong)',color:'var(--color-muted)',cursor:'pointer'}}>취소</span>
  </span>);
}

function StatementRow({ st, onDelete, onRetry }) {
  const [confirming,setConfirming] = React.useState(false);
  const canRetry = st.status === 'failed' || st.status === 'processing';
  return (<div style={{display:'flex',alignItems:'center',padding:'16px 0',borderBottom:'1px solid var(--color-hairline)',gap:16}}>
    <div style={{flex:1}}>
      <div style={{font:'var(--text-title-sm)'}}>{st.filename}</div>
      <div style={{font:'var(--text-caption)',color:'var(--color-muted)'}}>업로드 {st.uploadedAt} · {st.period} · {st.rows}건</div>
    </div>
    <StatusBadge status={st.status}/>
    <div style={{width:140,display:'flex',justifyContent:'flex-end',gap:12}}>
      {confirming ? <ConfirmDelete onCancel={()=>setConfirming(false)} onConfirm={()=>onDelete(st.id)}/> : (<React.Fragment>
        {canRetry ? <span onClick={()=>onRetry(st.id)} style={{font:'var(--text-caption-strong)',color:'var(--color-primary)',cursor:'pointer'}}>재시도</span> : null}
        <span onClick={()=>setConfirming(true)} style={{font:'var(--text-caption-strong)',color:'var(--color-muted)',cursor:'pointer'}}>삭제</span>
      </React.Fragment>)}
    </div>
  </div>);
}

function Statements({ statements, setStatements }) {
  function onDelete(id){ setStatements(prev => prev.filter(s=>s.id!==id)); }
  function onRetry(id){
    setStatements(prev => prev.map(s=>s.id===id ? {...s,status:'processing'} : s));
    setTimeout(()=>{
      setStatements(prev => prev.map(s=>s.id===id ? {...s,status:'completed',rows: s.rows || 148} : s));
    }, 1800);
  }
  return (<div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:'8px 24px'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 0'}}>
      <div style={{font:'var(--text-title-lg)'}}>업로드한 명세서</div>
      <Badge>{statements.length}건</Badge>
    </div>
    {statements.length === 0 ? <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',padding:'24px 0'}}>업로드된 명세서가 없습니다.</div> :
      statements.map(st=><StatementRow key={st.id} st={st} onDelete={onDelete} onRetry={onRetry}/>)}
  </div>);
}

function Billing({ plan, onOpenCheckout }) {
  return (<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,maxWidth:760}}>
    <div style={{background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:'var(--space-xl,32px)'}}>
      <div style={{font:'var(--text-title-sm)',color:'var(--color-muted)',marginBottom:12}}>Free</div>
      <div style={{font:'var(--text-display-md)',marginBottom:20}}>무료</div>
      <ul style={{listStyle:'none',padding:0,margin:'0 0 20px',font:'var(--text-body-md)',display:'flex',flexDirection:'column',gap:8}}>
        <li>계좌 1개 등록</li><li>최근 3개월 조회</li><li>카테고리별 지출 요약</li>
      </ul>
      {plan==='free' ? <Badge>현재 요금제</Badge> : null}
    </div>
    <div style={{background:'var(--color-surface-dark)',color:'var(--color-on-dark)',borderRadius:'var(--radius-xl)',padding:'var(--space-xl,32px)'}}>
      <div style={{font:'var(--text-title-sm)',color:'var(--color-on-dark-soft)',marginBottom:12}}>Pro</div>
      <div style={{font:'var(--text-display-md)',marginBottom:20}}>월 9,900원</div>
      <ul style={{listStyle:'none',padding:0,margin:'0 0 20px',font:'var(--text-body-md)',display:'flex',flexDirection:'column',gap:8}}>
        <li>계좌 무제한 등록</li><li>계좌별 전체 기간 조회</li><li>이상거래 탐지 (예정)</li><li>PDF/엑셀 내보내기 (예정)</li>
      </ul>
      {plan==='pro' ? <span style={{font:'var(--text-caption-strong)',color:'var(--color-on-dark)'}}>현재 요금제</span> :
        <Button variant="primary" onClick={onOpenCheckout}>Pro로 업그레이드</Button>}
    </div>
  </div>);
}

function CheckoutModal({ onClose, onSuccess }) {
  const [step,setStep] = React.useState('form');
  function pay(){
    setStep('processing');
    setTimeout(()=>{ setStep('done'); }, 1400);
  }
  return (<div style={{position:'fixed',inset:0,background:'rgba(14,16,19,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
    <div style={{width:420,background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',padding:32}}>
      {step === 'form' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:4}}>Pro 업그레이드</div>
        <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginBottom:24}}>Polar를 통해 안전하게 결제됩니다 · 월 9,900원</div>
        <div style={{font:'var(--text-caption-strong)',color:'var(--color-body)',marginBottom:6}}>카드 번호</div>
        <input placeholder="4242 4242 4242 4242" style={{width:'100%',boxSizing:'border-box',marginBottom:16,background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/>
        <div style={{display:'flex',gap:12,marginTop:8}}>
          <Button variant="secondary-light" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={pay}>월 9,900원 결제</Button>
        </div>
      </React.Fragment>)}
      {step === 'processing' && (<div style={{textAlign:'center',padding:'24px 0'}}><div style={{font:'var(--text-title-md)'}}>결제 처리 중…</div></div>)}
      {step === 'done' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:8}}>업그레이드 완료</div>
        <div style={{font:'var(--text-body-md)',color:'var(--color-body)',marginBottom:24}}>이제 계좌를 무제한으로 등록하고 전체 기간 데이터를 조회할 수 있습니다.</div>
        <Button variant="primary" onClick={onSuccess}><span style={{width:'100%',textAlign:'center'}}>대시보드로 이동</span></Button>
      </React.Fragment>)}
    </div>
  </div>);
}

function ConsentCheckbox({ checked, onChange }) {
  return (<label style={{display:'flex',gap:10,alignItems:'flex-start',cursor:'pointer',font:'var(--text-body-sm)',color:'var(--color-body)'}}>
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} style={{marginTop:3}}/>
    <span>업로드한 원본 CSV는 처리를 위해 Supabase Storage와 Anthropic(Claude API)에 전달되는 것에 동의합니다.</span>
  </label>);
}

function UploadModal({ onClose, onComplete }) {
  const [file,setFile] = React.useState(null);
  const [consent,setConsent] = React.useState(false);
  const [step,setStep] = React.useState('select'); // select, uploading, pending, processing, completed, failed
  const [progress,setProgress] = React.useState(0);

  React.useEffect(()=>{
    if(step !== 'uploading') return;
    setProgress(0);
    const t = setInterval(()=>{
      setProgress(p=>{
        if(p >= 100){ clearInterval(t); return 100; }
        return p + 8;
      });
    }, 90);
    return ()=>clearInterval(t);
  }, [step]);

  React.useEffect(()=>{
    if(step === 'uploading' && progress >= 100){
      const t = setTimeout(()=>setStep('pending'), 300);
      return ()=>clearTimeout(t);
    }
  }, [step, progress]);

  React.useEffect(()=>{
    if(step === 'pending'){
      const t = setTimeout(()=>setStep('processing'), 900);
      return ()=>clearTimeout(t);
    }
    if(step === 'processing'){
      const t = setTimeout(()=>setStep(Math.random() < 0.75 ? 'completed' : 'failed'), 1800);
      return ()=>clearTimeout(t);
    }
  }, [step]);

  function startUpload(){ setStep('uploading'); }
  function retry(){ setStep('processing'); }

  return (<div style={{position:'fixed',inset:0,background:'rgba(14,16,19,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
    <div style={{width:460,background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',padding:32}}>
      {step === 'select' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:4}}>명세서 업로드</div>
        <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginBottom:24}}>은행 또는 카드사에서 내려받은 CSV 파일을 업로드하세요.</div>
        <div onClick={()=>setFile('신한카드_2026-08.csv')} style={{border:'1px dashed var(--color-hairline)',borderRadius:'var(--radius-md)',padding:'28px 16px',textAlign:'center',cursor:'pointer',marginBottom:20,font:'var(--text-body-sm)',color:'var(--color-muted)'}}>
          {file ? <span style={{color:'var(--color-ink)',font:'var(--text-number-display)'}}>{file}</span> : '클릭해서 CSV 파일 선택'}
        </div>
        <div style={{marginBottom:24}}><ConsentCheckbox checked={consent} onChange={setConsent}/></div>
        <div style={{display:'flex',gap:12}}>
          <Button variant="secondary-light" onClick={onClose}>취소</Button>
          <Button variant="primary" disabled={!file || !consent} onClick={startUpload}>업로드 시작</Button>
        </div>
      </React.Fragment>)}
      {step === 'uploading' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:20}}>업로드 중…</div>
        <div style={{height:8,borderRadius:'var(--radius-pill)',background:'var(--color-surface-strong)',overflow:'hidden',marginBottom:12}}>
          <div style={{height:'100%',width:progress+'%',background:'var(--color-primary)',transition:'width .1s linear'}}></div>
        </div>
        <div style={{font:'var(--text-number-display)',color:'var(--color-muted)'}}>{progress}%</div>
      </React.Fragment>)}
      {(step === 'pending' || step === 'processing') && (<div style={{textAlign:'center',padding:'16px 0'}}>
        <div style={{font:'var(--text-title-md)',marginBottom:8}}>{step==='pending' ? '처리 대기 중' : '거래 내역 분석 중'}</div>
        <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)'}}>{step==='pending' ? '원본 파일을 검증하고 있습니다.' : 'Claude가 컬럼을 매핑하고 카테고리를 분류하고 있습니다.'}</div>
      </div>)}
      {step === 'completed' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:8}}>분석이 완료되었습니다</div>
        <div style={{font:'var(--text-body-md)',color:'var(--color-body)',marginBottom:24}}>142건의 거래를 확인하고 카테고리별로 정리했습니다.</div>
        <Button variant="primary" onClick={()=>onComplete(file)}><span style={{width:'100%',textAlign:'center'}}>결과 보기</span></Button>
      </React.Fragment>)}
      {step === 'failed' && (<React.Fragment>
        <div style={{font:'var(--text-title-lg)',marginBottom:8,color:'var(--color-semantic-down)'}}>처리에 실패했습니다</div>
        <div style={{font:'var(--text-body-md)',color:'var(--color-body)',marginBottom:24}}>파일 형식을 확인하거나 다시 시도해주세요.</div>
        <div style={{display:'flex',gap:12}}>
          <Button variant="secondary-light" onClick={onClose}>닫기</Button>
          <Button variant="primary" onClick={retry}>다시 시도</Button>
        </div>
      </React.Fragment>)}
    </div>
  </div>);
}

Object.assign(window, { Sidebar, Overview, Statements, Billing, CheckoutModal, UploadModal, PlanBadge });
