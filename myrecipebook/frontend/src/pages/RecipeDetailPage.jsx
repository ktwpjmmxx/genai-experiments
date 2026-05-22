import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchRecipe, toggleFavorite, uploadImage, askRecipeAI, deleteRecipe } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

const SERVING_OPTIONS = [0.5, 1, 2, 3, 4, 6]

function fmtNum(val) {
  if (!val || val <= 0)       return null
  if (Number.isInteger(val))  return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

function displayAmount(ing, ratio) {
  if (ing.amount_text) return ing.amount_text
  const n = fmtNum((ing.amount || 0) * ratio)
  if (!n) return ing.unit || '適量'
  return `${n} ${ing.unit}`.trim()
}

function isNumericAmount(ing) {
  return !ing.amount_text && ing.amount != null && ing.amount > 0
}

// ── AIパネル ──────────────────────────────────
function AIPanel({ recipe, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: `「${recipe.title}」について何でも聞いてください！` }
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const chatRef = useRef()
  const hints   = ['時短テクニックは？', 'みりんの代用は？', '失敗しないコツは？']

  const send = async (q) => {
    const text = q || input.trim(); if (!text || loading) return
    setMessages(m => [...m, { role: 'user', text }])
    setInput(''); setLoading(true)
    try {
      const res = await askRecipeAI(recipe.id, text)
      setMessages(m => [...m, { role: 'bot', text: res.answer }])
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'エラーが発生しました。' }])
    } finally {
      setLoading(false)
      setTimeout(() => chatRef.current?.scrollTo(0, 9999), 50)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 62, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      zIndex: 200, padding: '12px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold-dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
          ✦ AI アシスタント
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, color: 'var(--text-3)', padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
        }}>閉じる ✕</button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {hints.map(h => (
          <button key={h} onClick={() => send(h)} style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 999,
            border: '1px solid var(--border)', background: 'var(--bg)',
            color: 'var(--text-2)', cursor: 'pointer',
          }}>{h}</button>
        ))}
      </div>
      <div ref={chatRef} style={{
        maxHeight: 130, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '7px 11px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
            maxWidth: '88%', whiteSpace: 'pre-wrap',
            background: m.role === 'bot' ? 'var(--bg)' : 'var(--blue)',
            color:      m.role === 'bot' ? 'var(--text-1)' : '#fff',
            alignSelf:  m.role === 'bot' ? 'flex-start' : 'flex-end',
          }}>{m.text}</div>
        ))}
        {loading && (
          <div style={{ padding: '7px 11px', borderRadius: 10, background: 'var(--bg)', fontSize: 13, color: 'var(--text-3)' }}>
            回答中…
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="質問を入力…"
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', fontSize: 13,
            background: 'var(--bg)', color: 'var(--text-1)', outline: 'none',
          }} />
        <button onClick={() => send()} style={{
          padding: '8px 14px', background: 'var(--blue)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, cursor: 'pointer',
        }}>送信</button>
      </div>
    </div>
  )
}

// ── メイン ────────────────────────────────────
export default function RecipeDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [recipe,       setRecipe]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [servingIdx,   setServingIdx]   = useState(2)
  const [activeTab,    setActiveTab]    = useState('ingredients')
  const [checkedSteps, setCheckedSteps] = useState(new Set())
  const [showAI,       setShowAI]       = useState(false)
  const [showDelConf,  setShowDelConf]  = useState(false)

  useEffect(() => {
    fetchRecipe(id)
      .then(r => {
        setRecipe(r)
        const closest = SERVING_OPTIONS.reduce((best, s, i) =>
          Math.abs(s - r.base_servings) < Math.abs(SERVING_OPTIONS[best] - r.base_servings) ? i : best, 0)
        setServingIdx(closest)
      })
      .catch(() => navigate('/library'))
      .finally(() => setLoading(false))
  }, [id])

  const servings = SERVING_OPTIONS[servingIdx]

  const changeServing = (dir) =>
    setServingIdx(i => Math.max(0, Math.min(SERVING_OPTIONS.length - 1, i + dir)))

  const handleFav = async () => {
    const updated = await toggleFavorite(recipe.id)
    setRecipe(updated)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return
    const updated = await uploadImage(recipe.id, file)
    setRecipe(updated)
  }

  const handleDelete = async () => {
    await deleteRecipe(recipe.id)
    navigate('/library')
  }

  const toggleStep = (order) => {
    setCheckedSteps(prev => {
      const n = new Set(prev); n.has(order) ? n.delete(order) : n.add(order); return n
    })
  }

  // 買い物リストへ遷移（recipe と現在の servings を state で渡す）
  const goShopping = () => {
    navigate('/shopping', { state: { recipe, servings } })
  }

  if (loading) return <div className="spinner">読み込み中…</div>
  if (!recipe)  return null

  const ratio          = servings / recipe.base_servings
  const servingChanged = servings !== recipe.base_servings
  const doneCount      = checkedSteps.size
  const totalSteps     = recipe.steps.length
  const canScale       = recipe.ingredients.some(ing => isNumericAmount(ing))

  return (
    <div className="page-wrapper">

      {/* ── ゴールドヘッダー（戻る・タイトル・お気に入り） ── */}
      <div style={{
        background: 'var(--gold)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.4)',
          borderRadius: 'var(--radius-sm)', padding: '6px 12px',
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>← 戻る</button>
        <span style={{
          fontSize: 15, fontWeight: 600, color: '#fff', flex: 1,
          textAlign: 'center', padding: '0 8px',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>{recipe.title}</span>
        <button onClick={handleFav} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: recipe.is_favorite ? '#fff' : 'rgba(255,255,255,.2)',
          border: '1px solid rgba(255,255,255,.4)',
          borderRadius: 'var(--radius-sm)', padding: '6px 12px',
          color: recipe.is_favorite ? '#E24B4A' : '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all var(--t)',
        }}>
          {recipe.is_favorite ? '♥ 登録済み' : '♡ お気に入り'}
        </button>
      </div>

      {/* ── ヒーロー画像 ── */}
      <div style={{ position: 'relative', height: 220 }}>
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{
              width: '100%', height: '100%', background: 'var(--gold-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 72, opacity: .4 }}>🍳</span>
            </div>
        }
        {/* AI生成バッジ */}
        {recipe.is_ai_generated && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(109,40,217,.85)', color: '#fff',
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
          }}>✦ AI生成</div>
        )}
        <label style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(0,0,0,.5)', color: '#fff',
          padding: '5px 12px', borderRadius: 'var(--radius-sm)',
          fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          📷 写真を変更
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
        </label>
      </div>

      {/* ── ボディ ── */}
      <div style={{ padding: '16px 20px' }}>
        <span className={`cat-badge cat-${recipe.category}`}>{recipe.category}</span>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 10px', lineHeight: 1.25 }}>
          {recipe.title}
        </h1>
        {recipe.description && (
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 14 }}>
            {recipe.description}
          </p>
        )}

        {/* 人数ステッパー */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--gold-light)', border: '1px solid #E8D080',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 10,
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1 }}>👥 人数</span>
          <button onClick={() => changeServing(-1)} disabled={servingIdx === 0}
            style={{ width:32,height:32,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:servingIdx===0?'not-allowed':'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:servingIdx===0?'var(--text-3)':'var(--text-1)' }}>−</button>
          <div style={{ minWidth:64,textAlign:'center',fontSize:15,fontWeight:600,color:'var(--gold-dark)' }}>
            {servings}人前
          </div>
          <button onClick={() => changeServing(1)} disabled={servingIdx === SERVING_OPTIONS.length - 1}
            style={{ width:32,height:32,borderRadius:'50%',border:'1px solid var(--border)',background:'var(--surface)',cursor:servingIdx===SERVING_OPTIONS.length-1?'not-allowed':'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',color:servingIdx===SERVING_OPTIONS.length-1?'var(--text-3)':'var(--text-1)' }}>＋</button>
        </div>

        {/* 換算バッジ */}
        {servingChanged && canScale && (
          <div style={{
            fontSize: 12, color: 'var(--blue)', background: 'var(--blue-light)',
            border: '1px solid var(--blue-100)', borderRadius: 'var(--radius-sm)',
            padding: '5px 12px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            ↺ {recipe.base_servings}人前 → {servings}人前に換算済み
          </div>
        )}

        {/* 時間メタ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[{label:'下準備',value:`${recipe.prep_time}分`},{label:'調理',value:`${recipe.cook_time}分`}].map(item=>(
            <div key={item.label} style={{ background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:10,textAlign:'center',border:'1px solid var(--border)' }}>
              <div style={{ fontSize:18,fontWeight:600 }}>{item.value}</div>
              <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* タブ */}
        <div style={{ display:'flex',borderBottom:'1px solid var(--border)',marginBottom:14 }}>
          {[{key:'ingredients',label:`材料（${recipe.ingredients.length}種）`},{key:'steps',label:`作り方（${totalSteps}工程）`}].map(tab=>(
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)} style={{
              flex:1,padding:'9px 0',fontSize:13,fontWeight:600,background:'none',border:'none',cursor:'pointer',
              color:activeTab===tab.key?'var(--blue)':'var(--text-3)',
              borderBottom:activeTab===tab.key?'2px solid var(--blue)':'2px solid transparent',
              marginBottom:-1,transition:'all var(--t)',
            }}>{tab.label}</button>
          ))}
        </div>

        {/* 材料タブ */}
        {activeTab === 'ingredients' && (
          <div>
            {recipe.ingredients.map((ing, i) => {
              const scaled  = displayAmount(ing, ratio)
              const isFixed = !!ing.amount_text
              return (
                <div key={i} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'11px 0',
                  borderBottom:i<recipe.ingredients.length-1?'1px solid var(--border)':'none',
                  fontSize:14,
                }}>
                  <span>{ing.name}</span>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    {isFixed && servingChanged && (
                      <span style={{ fontSize:10,background:'var(--gold-light)',color:'var(--gold-dark)',padding:'1px 5px',borderRadius:4,border:'1px solid #E8D080' }}>固定</span>
                    )}
                    <span style={{ fontWeight:600,color:isFixed?'var(--text-2)':'var(--blue)',minWidth:80,textAlign:'right' }}>
                      {scaled}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 手順タブ */}
        {activeTab === 'steps' && (
          <div>
            {doneCount > 0 && (
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12,fontSize:12,color:'#3B6D11' }}>
                <div style={{ flex:1,height:4,background:'#EAF3DE',borderRadius:999,overflow:'hidden' }}>
                  <div style={{ height:'100%',background:'#639922',borderRadius:999,width:`${(doneCount/totalSteps)*100}%`,transition:'width .3s ease' }} />
                </div>
                <span>{doneCount} / {totalSteps} 完了</span>
              </div>
            )}
            <p style={{ fontSize:12,color:'var(--text-3)',marginBottom:10 }}>ステップをタップして完了をマーク</p>
            {recipe.steps.map(step => {
              const done = checkedSteps.has(step.order)
              return (
                <div key={step.order} onClick={() => toggleStep(step.order)} style={{
                  display:'flex',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)',
                  cursor:'pointer',opacity:done?.55:1,transition:'opacity var(--t)',
                }}>
                  <div style={{ width:28,height:28,borderRadius:'50%',flexShrink:0,background:done?'var(--text-3)':'var(--blue)',color:'#fff',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',marginTop:1 }}>
                    {done ? '✓' : step.order}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:14,lineHeight:1.7,textDecoration:done?'line-through':'none',color:done?'var(--text-3)':'var(--text-1)' }}>
                      {step.description}
                    </p>
                    {done && (
                      <div style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:'#3B6D11',background:'#EAF3DE',borderRadius:4,padding:'2px 8px',marginTop:4 }}>
                        ✓ 完了
                      </div>
                    )}
                    {step.tip && <div className="tip-box">💡 {step.tip}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── アクションボタン ── */}
        <div style={{ display:'flex',gap:8,marginTop:20,flexWrap:'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate(`/recipes/${id}/edit`)}>
            ✏️ 編集
          </button>
          <button className="btn btn-ghost" onClick={() => setShowAI(v => !v)}>
            ✦ AI相談
          </button>
          {/* 買い物リストボタン */}
          <button
            onClick={goShopping}
            style={{
              display:'inline-flex',alignItems:'center',gap:6,
              padding:'9px 14px',borderRadius:'var(--radius-sm)',
              background:'#EAF3DE',color:'#3B6D11',
              border:'1px solid #C0DD97',
              fontSize:14,fontWeight:600,cursor:'pointer',transition:'var(--t)',
            }}
            onMouseEnter={e => e.currentTarget.style.background='#D1ECBB'}
            onMouseLeave={e => e.currentTarget.style.background='#EAF3DE'}
          >
            🛒 買い物リスト
          </button>
          <button className="btn btn-danger" onClick={() => setShowDelConf(true)}>
            🗑 削除
          </button>
        </div>

        {/* 削除確認 */}
        {showDelConf && (
          <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:20 }}>
            <div style={{ background:'var(--surface)',borderRadius:'var(--radius-lg)',padding:24,maxWidth:320,width:'100%' }}>
              <p style={{ fontWeight:600,marginBottom:8 }}>「{recipe.title}」を削除しますか？</p>
              <p style={{ fontSize:13,color:'var(--text-3)',marginBottom:20 }}>この操作は取り消せません。</p>
              <div style={{ display:'flex',gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowDelConf(false)}>キャンセル</button>
                <button className="btn btn-danger" style={{ flex:1 }} onClick={handleDelete}>削除する</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAI && <AIPanel recipe={recipe} onClose={() => setShowAI(false)} />}
      <BottomNav />
    </div>
  )
}
