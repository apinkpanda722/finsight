const { NavBar, Button, Input, Badge, ProductCard, FeatureCard, PricingCard, Footer, AssetRow } = window.FinsightDesignSystem_c404e7;
const D = window.FINSIGHT_DATA;

function AuthShell({ children, maxWidth = 420 }) {
  return (
    <div style={{minHeight:'100vh',background:'var(--color-surface-soft)',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'24px 32px'}}>
        <div style={{font:'600 18px var(--font-display)',color:'var(--color-ink)',cursor:'default'}}>finsight</div>
      </div>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{width:'100%',maxWidth,background:'var(--color-canvas)',borderRadius:'var(--radius-xl)',border:'var(--border-hairline)',padding:'40px 36px'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

function FormField({ label, error, children }) {
  return (<div style={{marginBottom:16}}>
    <div style={{font:'var(--text-caption-strong)',color:'var(--color-body)',marginBottom:6}}>{label}</div>
    {children}
    {error ? <div style={{font:'var(--text-caption)',color:'var(--color-semantic-down)',marginTop:6}}>{error}</div> : null}
  </div>);
}

function Landing({ onNavigate }) {
  return (<div>
    <div style={{background:'var(--color-surface-dark)',color:'var(--color-on-dark)'}}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'0 32px'}}>
        <div style={{height:64,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{font:'600 18px var(--font-display)'}}>finsight</div>
          <div style={{display:'flex',gap:12}}>
            <Button variant="text" onClick={()=>onNavigate('login')}><span style={{color:'var(--color-on-dark)'}}>로그인</span></Button>
            <Button variant="primary" onClick={()=>onNavigate('signup')}>무료로 시작하기</Button>
          </div>
        </div>
      </div>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'80px 32px 96px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center'}}>
        <div>
          <Badge>개인 가계부</Badge>
          <div style={{font:'var(--text-display-mega)',letterSpacing:'var(--ls-display-mega)',margin:'24px 0'}}>지출을 있는 그대로,<br/>이해하기 쉽게.</div>
          <div style={{font:'var(--text-body-md)',color:'var(--color-on-dark-soft)',marginBottom:32,maxWidth:420}}>은행과 카드사에서 받은 CSV 명세서를 업로드하면 카테고리별 지출과 월별 추이를 자동으로 정리해 드립니다.</div>
          <div style={{display:'flex',gap:16}}>
            <Button variant="primary" size="lg" onClick={()=>onNavigate('signup')}>무료로 시작하기</Button>
            <Button variant="outline-dark" size="lg" onClick={()=>onNavigate('pricing')}>요금제 보기</Button>
          </div>
        </div>
        <div style={{position:'relative',height:420}}>
          <div style={{position:'absolute',top:0,left:0,width:260,transform:'rotate(-4deg)'}}>
            <ProductCard tone="dark">
              <div style={{font:'var(--text-caption)',color:'var(--color-on-dark-soft)',marginBottom:8}}>8월 지출</div>
              <div style={{font:'var(--text-display-sm)'}}>{D.won(D.monthly[5].total)}</div>
              <div style={{font:'var(--text-number-display)',color:'var(--color-semantic-up)',marginTop:8}}>전월 대비 +6.5%</div>
            </ProductCard>
          </div>
          <div style={{position:'absolute',top:230,left:150,width:280,transform:'rotate(3deg)'}}>
            <ProductCard tone="dark">
              {D.categories.slice(0,2).map(c=>(<div key={c.key} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                <span style={{font:'var(--text-body-sm)',color:'var(--color-on-dark-soft)'}}>{c.label}</span>
                <span style={{font:'var(--text-number-display)'}}>{D.won(c.amount)}</span>
              </div>))}
            </ProductCard>
          </div>
        </div>
      </div>
    </div>

    <div style={{maxWidth:1200,margin:'0 auto',padding:'96px 32px'}}>
      <Badge>기능</Badge>
      <div style={{font:'var(--text-display-md)',margin:'16px 0 40px',maxWidth:640}}>CSV 한 장이면 정리는 자동으로 끝납니다.</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:24}}>
        <FeatureCard title="자동 컬럼 매핑" description="은행마다 형식이 다른 CSV를 자동으로 인식해 정리합니다."/>
        <FeatureCard title="카테고리 자동 분류" description="거래 내역을 분석해 식비, 교통, 쇼핑 등으로 자동 분류합니다."/>
        <FeatureCard title="계좌별 히스토리" description="계좌를 등록하고 지출 추이를 꾸준히 기록합니다."/>
      </div>
    </div>

    <div id="pricing" style={{background:'var(--color-surface-soft)'}}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'96px 32px'}}>
        <div style={{font:'var(--text-display-sm)',marginBottom:40,textAlign:'center'}}>간단한 요금제</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,maxWidth:760,margin:'0 auto'}}>
          <PricingCard tier="Free" price="무료" features={['계좌 1개 등록','최근 3개월 조회','카테고리별 지출 요약']}/>
          <PricingCard tier="Pro" price="월 9,900원" featured features={['계좌 무제한 등록','계좌별 전체 기간 조회','이상거래 탐지 (예정)','PDF/엑셀 내보내기 (예정)']}/>
        </div>
      </div>
    </div>

    <div style={{background:'var(--color-surface-dark)',color:'var(--color-on-dark)',textAlign:'center'}}>
      <div style={{maxWidth:1200,margin:'0 auto',padding:'96px 32px'}}>
        <div style={{font:'var(--text-display-lg)',letterSpacing:'var(--ls-display-lg)',marginBottom:32}}>지금 첫 명세서를 업로드해보세요.</div>
        <Button variant="primary" size="lg" onClick={()=>onNavigate('signup')}>무료로 시작하기</Button>
      </div>
    </div>
    <Footer columns={[
      { title:'제품', links:['기능','요금제','보안'] },
      { title:'회사', links:['소개','문의'] },
      { title:'자료', links:['이용약관','개인정보처리방침'] },
    ]}/>
  </div>);
}

function Signup({ onNavigate }) {
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const [confirm,setConfirm] = React.useState('');
  const [errors,setErrors] = React.useState({});

  function submit(){
    const e = {};
    if(!/^\S+@\S+\.\S+$/.test(email)) e.email = '올바른 이메일 주소를 입력해주세요.';
    if(password.length < 8) e.password = '비밀번호는 8자 이상이어야 합니다.';
    if(confirm !== password) e.confirm = '비밀번호가 일치하지 않습니다.';
    setErrors(e);
    if(Object.keys(e).length === 0) onNavigate('verify', { email });
  }

  return (<AuthShell>
    <div style={{font:'var(--text-title-lg)',marginBottom:8}}>회원가입</div>
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginBottom:28}}>이메일로 가입하고 3분 안에 첫 명세서를 업로드하세요.</div>
    <FormField label="이메일" error={errors.email}><Input value={email} onChange={setEmail} placeholder="you@example.com"/></FormField>
    <FormField label="비밀번호" error={errors.password}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상" style={{width:'100%',boxSizing:'border-box',background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/></FormField>
    <FormField label="비밀번호 확인" error={errors.confirm}><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="비밀번호 재입력" style={{width:'100%',boxSizing:'border-box',background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/></FormField>
    <Button variant="primary" size="lg" onClick={submit}><span style={{width:'100%',textAlign:'center'}}>가입하기</span></Button>
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginTop:20,textAlign:'center'}}>이미 계정이 있나요? <span style={{color:'var(--color-primary)',cursor:'pointer'}} onClick={()=>onNavigate('login')}>로그인</span></div>
  </AuthShell>);
}

function VerifyEmail({ onNavigate, params }) {
  const email = (params && params.email) || 'you@example.com';
  return (<AuthShell>
    <Badge>이메일 인증 대기 중</Badge>
    <div style={{font:'var(--text-title-lg)',margin:'16px 0 8px'}}>메일함을 확인해주세요</div>
    <div style={{font:'var(--text-body-md)',color:'var(--color-body)',marginBottom:28}}><span style={{font:'var(--text-number-display)'}}>{email}</span> 주소로 인증 메일을 보냈습니다. 링크를 클릭하면 가입이 완료됩니다.</div>
    <Button variant="primary" size="lg" onClick={()=>onNavigate('login', { email, justVerified:true })}><span style={{width:'100%',textAlign:'center'}}>메일함에서 인증 완료했어요</span></Button>
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginTop:20,textAlign:'center'}}>메일이 오지 않았나요? <span style={{color:'var(--color-primary)',cursor:'pointer'}}>다시 보내기</span></div>
  </AuthShell>);
}

function Login({ onNavigate, onLogin, params }) {
  const [email,setEmail] = React.useState((params && params.email) || '');
  const [password,setPassword] = React.useState('');
  const [error,setError] = React.useState('');
  const justVerified = params && params.justVerified;

  function submit(){
    if(!email || !password){ setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setError('');
    onLogin();
  }

  return (<AuthShell>
    {justVerified ? <div style={{background:'var(--color-surface-strong)',borderRadius:'var(--radius-md)',padding:'12px 16px',font:'var(--text-body-sm)',color:'var(--color-ink)',marginBottom:24}}>이메일 인증이 완료되었습니다. 로그인해주세요.</div> : null}
    <div style={{font:'var(--text-title-lg)',marginBottom:28}}>로그인</div>
    <FormField label="이메일"><Input value={email} onChange={setEmail} placeholder="you@example.com"/></FormField>
    <FormField label="비밀번호" error={error}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="비밀번호" style={{width:'100%',boxSizing:'border-box',background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/></FormField>
    <div style={{textAlign:'right',marginBottom:20}}><span style={{font:'var(--text-body-sm)',color:'var(--color-primary)',cursor:'pointer'}} onClick={()=>onNavigate('forgot')}>비밀번호를 잊으셨나요?</span></div>
    <Button variant="primary" size="lg" onClick={submit}><span style={{width:'100%',textAlign:'center'}}>로그인</span></Button>
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginTop:20,textAlign:'center'}}>계정이 없나요? <span style={{color:'var(--color-primary)',cursor:'pointer'}} onClick={()=>onNavigate('signup')}>회원가입</span></div>
  </AuthShell>);
}

function ForgotPassword({ onNavigate }) {
  const [email,setEmail] = React.useState('');
  const [sent,setSent] = React.useState(false);
  return (<AuthShell>
    <div style={{font:'var(--text-title-lg)',marginBottom:8}}>비밀번호 재설정</div>
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginBottom:28}}>가입한 이메일 주소를 입력하면 재설정 링크를 보내드립니다.</div>
    <FormField label="이메일"><Input value={email} onChange={setEmail} placeholder="you@example.com"/></FormField>
    {sent ? <div style={{font:'var(--text-body-sm)',color:'var(--color-semantic-up)',marginBottom:16}}>재설정 메일을 보냈습니다.</div> : null}
    {!sent ? <Button variant="primary" size="lg" onClick={()=>setSent(true)}><span style={{width:'100%',textAlign:'center'}}>재설정 링크 보내기</span></Button>
      : <Button variant="secondary-light" size="lg" onClick={()=>onNavigate('reset')}><span style={{width:'100%',textAlign:'center'}}>재설정 링크 열기 (데모)</span></Button>}
    <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginTop:20,textAlign:'center'}}><span style={{color:'var(--color-primary)',cursor:'pointer'}} onClick={()=>onNavigate('login')}>로그인으로 돌아가기</span></div>
  </AuthShell>);
}

function ResetPassword({ onNavigate }) {
  const [password,setPassword] = React.useState('');
  const [confirm,setConfirm] = React.useState('');
  const [error,setError] = React.useState('');
  const [done,setDone] = React.useState(false);
  function submit(){
    if(password.length < 8){ setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if(password !== confirm){ setError('비밀번호가 일치하지 않습니다.'); return; }
    setError(''); setDone(true);
  }
  if(done){
    return (<AuthShell>
      <div style={{font:'var(--text-title-lg)',marginBottom:8}}>비밀번호가 변경되었습니다</div>
      <div style={{font:'var(--text-body-sm)',color:'var(--color-muted)',marginBottom:28}}>새 비밀번호로 로그인해주세요.</div>
      <Button variant="primary" size="lg" onClick={()=>onNavigate('login')}><span style={{width:'100%',textAlign:'center'}}>로그인하러 가기</span></Button>
    </AuthShell>);
  }
  return (<AuthShell>
    <div style={{font:'var(--text-title-lg)',marginBottom:28}}>새 비밀번호 설정</div>
    <FormField label="새 비밀번호"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상" style={{width:'100%',boxSizing:'border-box',background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/></FormField>
    <FormField label="새 비밀번호 확인" error={error}><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="비밀번호 재입력" style={{width:'100%',boxSizing:'border-box',background:'var(--color-canvas)',color:'var(--color-ink)',borderRadius:'var(--radius-md)',padding:'14px 16px',height:48,border:'1px solid var(--color-hairline)',font:'400 16px/1.5 var(--font-body)'}}/></FormField>
    <Button variant="primary" size="lg" onClick={submit}><span style={{width:'100%',textAlign:'center'}}>비밀번호 변경</span></Button>
  </AuthShell>);
}

Object.assign(window, { Landing, Signup, VerifyEmail, Login, ForgotPassword, ResetPassword });
