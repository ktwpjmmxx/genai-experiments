import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { discoverRecipes, generateRecipe, createRecipe } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

const MOODS = ['さっぱりしたもの', 'ガッツリ食べたい', '体に優しいもの', '簡単に作れるもの', 'おしゃれな一品']
const TIMES = [{ label: '15分以内', value: 15 }, { label: '30分以内', value: 30 }, { label: '60分以内', value: 60 }, { label: '時間をかけてOK', value: null }]
const CATEGORIES = ['和食', '洋食', '中華', 'イタリアン', 'アジアン', '副菜', 'こだわらない']

// ── 提案カード ──
function SuggestionCard({ item, onSelect }) {
  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', padding: '14px 16px',
        cursor: 'pointer', transition: 'box-shadow var(--t), transform var(--t)',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.transform = '' }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-sm)',
        background: 'var(--gold-light)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22, flexShrink: 0,
      }}>🍳</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, lineHeight: 1.5 }}>
          {item.description}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`cat-badge cat-${item.category}`}>{item.category}</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⏱ {item.cook_time}分</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>👥 {item.servings}人前</span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>
        詳しく見る ›
      </div>
    </div>
  )
}

// ── 生成済みレシピプレビュー ──
function GeneratedRecipePreview({ recipe, onSave, onBack, saving }) {
  const [activeTab, setActiveTab] = useState('ingredients')
  const [servings, setServings]   = useState(recipe.base_servings)

  const SERVING_OPTIONS = [0.5, 1, 2, 3, 4, 6]
  const idx    = SERVING_OPTIONS.indexOf(servings) === -1 ? 2 : SERVING_OPTIONS.indexOf(servings)
  const ratio  = servings / recipe.base_servings

  const fmtAmt = (val) => {
    if (!val || val <= 0) return null
    if (Number.isInteger(val)) return String(val)
    const f = val.toFixed(1)
    return f.endsWith('.0') ? f.slice(0, -2) : f
  }

  const displayAmount = (ing) => {
    if (ing.amount_text) return ing.amount_text
    const n = fmtAmt((ing.amount || 0) * ratio)
    if (!n) return ing.unit || '適量'
    return `${n} ${ing.unit}`.trim()
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)',
            borderRadius: 'var(--radius-sm)', padding: '6px 12px',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>← 戻る</button>
          <span className="topbar-title" style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
            AIが生成したレシピ
          </span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      {/* ヒーロー */}
      <div style={{
        height: 160, background: 'var(--gold-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64,
      }}>🍳</div>

      <div style={{ padding: '16px 20px' }}>
        {/* AIバッジ */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: '#EEEDFE', color: '#534AB7',
          border: '1px solid #AFA9EC', borderRadius: 999,
          fontSize: 11, fontWeight: 600, padding: '3px 10px', marginBottom: 8,
        }}>✦ AIが生成したレシピ</div>

        <span className={`cat-badge cat-${recipe.category}`}>{recipe.category}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px', lineHeight: 1.25 }}>
          {recipe.title}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>
          {recipe.description}
        </p>

        {/* 人数ステッパー */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--gold-light)', border: '1px solid #E8D080',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>👥 人数</span>
          <button onClick={() => { const i = SERVING_OPTIONS.indexOf(servings); if(i>0) setServings(SERVING_OPTIONS[i-1]) }}
            disabled={idx === 0}
            style={{ width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
          <div style={{ minWidth:64,textAlign:'center',fontSize:15,fontWeight:600,color:'var(--gold-dark)' }}>{servings}人前</div>
          <button onClick={() => { const i = SERVING_OPTIONS.indexOf(servings); if(i<SERVING_OPTIONS.length-1) setServings(SERVING_OPTIONS[i+1]) }}
            disabled={idx === SERVING_OPTIONS.length - 1}
            style={{ width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>＋</button>
        </div>

        {/* 時間メタ */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:16 }}>
          {[{label:'下準備',value:`${recipe.prep_time}分`},{label:'調理',value:`${recipe.cook_time}分`}].map(item=>(
            <div key={item.label} style={{ background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:10,textAlign:'center',border:'1px solid var(--border)' }}>
              <div style={{ fontSize:18,fontWeight:600 }}>{item.value}</div>
              <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* タブ */}
        <div style={{ display:'flex',borderBottom:'1px solid var(--border)',marginBottom:14 }}>
          {[{key:'ingredients',label:`材料（${recipe.ingredients.length}種）`},{key:'steps',label:`作り方（${recipe.steps.length}工程）`}].map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{
              flex:1,padding:'9px 0',fontSize:13,fontWeight:600,background:'none',border:'none',cursor:'pointer',
              color:activeTab===tab.key?'var(--blue)':'var(--text-3)',
              borderBottom:activeTab===tab.key?'2px solid var(--blue)':'2px solid transparent',
              marginBottom:-1,transition:'all var(--t)',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* 材料 */}
        {activeTab === 'ingredients' && (
          <div>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{
                display:'flex',justifyContent:'space-between',alignItems:'center',
                padding:'11px 0',
                borderBottom:i<recipe.ingredients.length-1?'1px solid var(--border)':'none',fontSize:14,
              }}>
                <span>{ing.name}</span>
                <span style={{ fontWeight:600,color:'var(--blue)',minWidth:80,textAlign:'right' }}>
                  {displayAmount(ing)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 手順 */}
        {activeTab === 'steps' && (
          <div>
            {recipe.steps.map(step => (
              <div key={step.order} style={{ display:'flex',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)' }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:'var(--blue)',color:'#fff',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
                  {step.order}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:14,lineHeight:1.7 }}>{step.description}</p>
                  {step.tip && (
                    <div className="tip-box">💡 {step.tip}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 評価・保存ボタン */}
        <div style={{ marginTop: 24, background:'var(--gold-light)',border:'1px solid #E8D080',borderRadius:'var(--radius-md)',padding:16 }}>
          <p style={{ fontSize:13,fontWeight:600,color:'var(--gold-dark)',marginBottom:12,textAlign:'center' }}>
            このレシピはどうでしたか？
          </p>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={() => onSave('save')} disabled={saving}
              style={{
                flex:2,padding:'11px 0',borderRadius:'var(--radius-sm)',
                background:'var(--blue)',color:'#fff',border:'none',
                fontSize:14,fontWeight:600,cursor:saving?'not-allowed':'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',gap:6,
              }}>
              {saving ? '保存中…' : '⭐ また作りたい → ライブラリに保存'}
            </button>
          </div>
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <button onClick={() => onSave('neutral')}
              style={{ flex:1,padding:'9px 0',borderRadius:'var(--radius-sm)',background:'var(--bg)',border:'1px solid var(--border)',fontSize:13,cursor:'pointer' }}>
              😐 微妙
            </button>
            <button onClick={() => onSave('never')}
              style={{ flex:1,padding:'9px 0',borderRadius:'var(--radius-sm)',background:'#fef2f2',border:'1px solid #fecaca',color:'#b91c1c',fontSize:13,cursor:'pointer' }}>
              🚫 二度と作らない
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── メインページ ──────────────────────────────
export default function DiscoverPage() {
  const navigate = useNavigate()

  const [step,     setStep]     = useState('filter')   // filter → loading → results → generating → preview → done
  const [mood,     setMood]     = useState('')
  const [maxTime,  setMaxTime]  = useState(null)
  const [category, setCategory] = useState('こだわらない')
  const [servings, setServings] = useState(2)
  const [results,  setResults]  = useState([])
  const [generated,setGenerated]= useState(null)
  const [isMock,   setIsMock]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [savedId,  setSavedId]  = useState(null)

  const handleDiscover = async () => {
    setStep('loading')
    try {
      const params = {
        mood:     mood     || undefined,
        max_time: maxTime  || undefined,
        category: category === 'こだわらない' ? undefined : category,
      }
      const res = await discoverRecipes(params)
      setResults(res.items)
      setIsMock(res.is_mock)
      setStep('results')
    } catch {
      setStep('filter')
      alert('提案の取得に失敗しました。バックエンドが起動しているか確認してください。')
    }
  }

  const handleSelectItem = async (item) => {
    setStep('generating')
    try {
      const res = await generateRecipe({ title: item.title, servings })
      setGenerated(res)
      setStep('preview')
    } catch {
      setStep('results')
      alert('レシピの生成に失敗しました。')
    }
  }

  const handleSave = async (rating) => {
    if (rating !== 'save') {
      // 保存しない → フィルター画面に戻る
      setStep('filter')
      setGenerated(null)
      return
    }
    setSaving(true)
    try {
      const payload = {
        title:           generated.title,
        category:        generated.category,
        description:     generated.description,
        base_servings:   generated.base_servings,
        prep_time:       generated.prep_time,
        cook_time:       generated.cook_time,
        is_ai_generated: true,
        ingredients:     generated.ingredients,
        steps:           generated.steps,
      }
      const saved = await createRecipe(payload)
      setSavedId(saved.id)
      setStep('done')
    } catch {
      alert('保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  // ── フィルター画面 ──
  if (step === 'filter') return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate('/home')} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 12px',
            color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
          }}>← 戻る</button>
          <span className="topbar-title" style={{ flex:1,textAlign:'center' }}>AIに相談する</span>
          <div style={{ width:60 }} />
        </div>
      </div>

      <div style={{ padding:'20px 16px' }}>
        <p style={{ fontSize:13,color:'var(--text-2)',lineHeight:1.7,marginBottom:20 }}>
          今日の気分や条件を教えてください。AIが料理を提案します。<br />
          <span style={{ fontSize:12,color:'var(--text-3)' }}>※ すべて任意です。スキップしてもOK。</span>
        </p>

        {/* 気分 */}
        <div style={{ marginBottom:20 }}>
          <div className="field-label">今日の気分（任意）</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
            {MOODS.map(m => (
              <button key={m} onClick={() => setMood(mood === m ? '' : m)} style={{
                padding:'7px 14px',borderRadius:999,fontSize:13,border:'1px solid',
                borderColor: mood===m ? 'var(--blue)' : 'var(--border)',
                background:  mood===m ? 'var(--blue)' : 'var(--surface)',
                color:       mood===m ? '#fff' : 'var(--text-2)',
                cursor:'pointer',
              }}>{m}</button>
            ))}
          </div>
        </div>

        {/* 調理時間 */}
        <div style={{ marginBottom:20 }}>
          <div className="field-label">調理にかけられる時間（任意）</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
            {TIMES.map(t => (
              <button key={t.label} onClick={() => setMaxTime(maxTime===t.value ? null : t.value)} style={{
                padding:'7px 14px',borderRadius:999,fontSize:13,border:'1px solid',
                borderColor: maxTime===t.value ? 'var(--blue)' : 'var(--border)',
                background:  maxTime===t.value ? 'var(--blue)' : 'var(--surface)',
                color:       maxTime===t.value ? '#fff' : 'var(--text-2)',
                cursor:'pointer',
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* カテゴリ */}
        <div style={{ marginBottom:20 }}>
          <div className="field-label">カテゴリ（任意）</div>
          <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding:'7px 14px',borderRadius:999,fontSize:13,border:'1px solid',
                borderColor: category===c ? 'var(--blue)' : 'var(--border)',
                background:  category===c ? 'var(--blue)' : 'var(--surface)',
                color:       category===c ? '#fff' : 'var(--text-2)',
                cursor:'pointer',
              }}>{c}</button>
            ))}
          </div>
        </div>

        {/* 人数 */}
        <div style={{ marginBottom:24 }}>
          <div className="field-label">何人前のレシピを生成しますか？</div>
          <div style={{ display:'flex',alignItems:'center',gap:12,background:'var(--gold-light)',border:'1px solid #E8D080',borderRadius:'var(--radius-sm)',padding:'10px 14px' }}>
            <span style={{ fontSize:13,color:'var(--text-2)',flex:1 }}>👥 人数</span>
            <button onClick={() => setServings(s => Math.max(1,s-1))} style={{ width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
            <span style={{ minWidth:48,textAlign:'center',fontSize:15,fontWeight:600,color:'var(--gold-dark)' }}>{servings}人前</span>
            <button onClick={() => setServings(s => Math.min(6,s+1))} style={{ width:30,height:30,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center' }}>＋</button>
          </div>
        </div>

        <button onClick={handleDiscover} className="btn btn-primary" style={{ width:'100%',justifyContent:'center',padding:'13px 0',fontSize:15 }}>
          ✦ AIに料理を提案してもらう
        </button>
      </div>
      <BottomNav />
    </div>
  )

  // ── ローディング ──
  if (step === 'loading') return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16 }}>
      <div style={{ fontSize:40,animation:'spin 1s linear infinite' }}>✦</div>
      <p style={{ fontSize:15,color:'var(--text-2)' }}>AIが料理を考えています…</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── 生成中 ──
  if (step === 'generating') return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16 }}>
      <div style={{ fontSize:40,animation:'spin 1s linear infinite' }}>🍳</div>
      <p style={{ fontSize:15,color:'var(--text-2)' }}>レシピを生成しています…</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── 提案リスト ──
  if (step === 'results') return (
    <div className="page-wrapper">
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => setStep('filter')} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 12px',
            color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
          }}>← 条件を変える</button>
          <span className="topbar-title" style={{ flex:1,textAlign:'center' }}>AIの提案</span>
          <div style={{ width:80 }} />
        </div>
      </div>

      <div style={{ padding:'16px 16px' }}>
        {isMock && (
          <div style={{
            background:'var(--gold-light)',border:'1px solid #E8D080',
            borderRadius:'var(--radius-sm)',padding:'8px 12px',
            fontSize:12,color:'var(--gold-dark)',marginBottom:14,
          }}>
            💡 現在はモックデータを表示しています。OPENAI_API_KEY を設定するとAIが本格提案します。
          </div>
        )}
        <p style={{ fontSize:13,color:'var(--text-2)',marginBottom:14 }}>
          気になる料理をタップするとレシピ全文を生成します
        </p>
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {results.map((item, i) => (
            <SuggestionCard key={i} item={item} onSelect={handleSelectItem} />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )

  // ── レシピプレビュー ──
  if (step === 'preview' && generated) return (
    <div className="page-wrapper">
      <GeneratedRecipePreview
        recipe={generated}
        onSave={handleSave}
        onBack={() => setStep('results')}
        saving={saving}
      />
      <BottomNav />
    </div>
  )

  // ── 保存完了 ──
  if (step === 'done') return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:16,padding:24 }}>
      <div style={{ fontSize:56 }}>🎉</div>
      <p style={{ fontSize:18,fontWeight:600 }}>ライブラリに保存しました！</p>
      <p style={{ fontSize:13,color:'var(--text-3)',textAlign:'center',lineHeight:1.7 }}>
        次回から「ライブラリ」タブで確認できます
      </p>
      <div style={{ display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:280 }}>
        <button className="btn btn-primary" style={{ justifyContent:'center',padding:'12px 0' }}
          onClick={() => navigate(`/recipes/${savedId}`)}>
          レシピを見る
        </button>
        <button className="btn btn-ghost" style={{ justifyContent:'center',padding:'12px 0' }}
          onClick={() => { setStep('filter'); setGenerated(null) }}>
          もう一品相談する
        </button>
        <button className="btn btn-ghost" style={{ justifyContent:'center',padding:'12px 0' }}
          onClick={() => navigate('/home')}>
          ホームに戻る
        </button>
      </div>
    </div>
  )

  return null
}
