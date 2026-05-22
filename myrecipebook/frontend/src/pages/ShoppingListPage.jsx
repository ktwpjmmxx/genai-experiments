import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import '../global.css'

/**
 * 買い物リストページ
 * - RecipeDetailPage から navigate('/shopping', { state: { recipe, servings } }) で遷移
 * - 各材料に「手元にある量」を入力すると差し引いた購入量を表示
 * - 保存しない（毎回フレッシュスタート）設計
 */

function fmtNum(val) {
  if (!val || val <= 0) return null
  if (Number.isInteger(val)) return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

export default function ShoppingListPage() {
  const navigate = useNavigate()
  const { state } = useLocation()

  // RecipeDetailPage から渡ってくる { recipe, servings }
  const recipe   = state?.recipe
  const servings = state?.servings

  // 手元の在庫入力（material の name をキーにした map）
  const [pantry,   setPantry]   = useState({})
  // 購入済みチェック
  const [checked,  setChecked]  = useState(new Set())
  // 表示モード: 'input'（残量入力）→ 'list'（買い物リスト）
  const [mode,     setMode]     = useState('input')

  // ページ遷移前のデータチェック
  if (!recipe || !servings) {
    return (
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:12,padding:24 }}>
        <p style={{ fontSize:15,color:'var(--text-2)' }}>レシピ詳細から買い物リストを作成してください。</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>戻る</button>
      </div>
    )
  }

  const ratio = servings / recipe.base_servings

  // 数値換算できる材料（amount が数値のもの）
  const numericItems = recipe.ingredients.filter(ing => !ing.amount_text && ing.amount != null && ing.amount > 0)
  // テキスト材料（目分量系）
  const textItems    = recipe.ingredients.filter(ing => ing.amount_text || !ing.amount)

  // 差し引き計算
  const calcNeeded = (ing) => {
    const required = (ing.amount || 0) * ratio
    const have     = parseFloat(pantry[ing.name] || 0) || 0
    return Math.max(0, required - have)
  }

  // 合計金額（未実装・将来用）
  const listItems = numericItems.map(ing => ({
    ...ing,
    required: (ing.amount || 0) * ratio,
    have:     parseFloat(pantry[ing.name] || 0) || 0,
    needed:   calcNeeded(ing),
  }))

  const allDone = listItems.filter(i => i.needed > 0).every(i => checked.has(i.name))
    && textItems.every(i => checked.has(i.name))

  return (
    <div className="page-wrapper">

      {/* ヘッダー */}
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate(-1)} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 12px',
            color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
          }}>← 戻る</button>
          <span className="topbar-title" style={{ flex:1,textAlign:'center' }}>買い物リスト</span>
          {/* モード切替 */}
          <button onClick={() => setMode(m => m==='input' ? 'list' : 'input')} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 10px',
            color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',
          }}>{mode==='input' ? 'リストへ →' : '← 残量入力'}</button>
        </div>
      </div>

      {/* レシピ名・人数バッジ */}
      <div style={{
        padding:'12px 16px',background:'var(--gold-light)',
        borderBottom:'1px solid #E8D080',
        display:'flex',alignItems:'center',gap:10,
      }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15,fontWeight:600,color:'var(--gold-dark)' }}>{recipe.title}</div>
          <div style={{ fontSize:12,color:'var(--text-3)',marginTop:2 }}>
            {recipe.base_servings}人前のレシピ → {servings}人前に換算
          </div>
        </div>
        <span style={{
          background:'var(--blue)',color:'#fff',
          padding:'4px 12px',borderRadius:999,fontSize:12,fontWeight:600,
        }}>👥 {servings}人前</span>
      </div>

      {/* ── 残量入力モード ── */}
      {mode === 'input' && (
        <div style={{ padding:'16px 16px' }}>
          <div style={{
            background:'var(--blue-light)',border:'1px solid var(--blue-100)',
            borderRadius:'var(--radius-sm)',padding:'10px 14px',
            fontSize:13,color:'var(--blue)',marginBottom:16,lineHeight:1.6,
          }}>
            💡 冷蔵庫に残っている分を入力すると、必要な購入量から差し引きます。<br />
            <strong>空欄のままでもOK</strong>（その場合は全量を購入リストに追加します）
          </div>

          {/* 数値材料 */}
          {numericItems.length > 0 && (
            <>
              <div style={{ fontSize:12,fontWeight:600,color:'var(--text-3)',marginBottom:8 }}>
                計算できる材料（数値入力）
              </div>
              {numericItems.map((ing, i) => {
                const required = (ing.amount || 0) * ratio
                const have     = parseFloat(pantry[ing.name] || 0) || 0
                const needed   = Math.max(0, required - have)
                return (
                  <div key={i} style={{
                    background:'var(--surface)',border:'1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',padding:'12px',marginBottom:8,
                  }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
                      <span style={{ fontSize:14,fontWeight:500 }}>{ing.name}</span>
                      <span style={{ fontSize:12,color:'var(--text-3)' }}>
                        必要: {fmtNum(required)} {ing.unit}
                      </span>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:12,color:'var(--text-3)',width:80,flexShrink:0 }}>手元にある:</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0"
                        value={pantry[ing.name] || ''}
                        onChange={e => setPantry(p => ({ ...p, [ing.name]: e.target.value }))}
                        style={{
                          width:80,padding:'6px 8px',
                          border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',
                          fontSize:14,textAlign:'right',outline:'none',
                        }}
                        onFocus={e => e.target.style.borderColor='var(--blue)'}
                        onBlur={e  => e.target.style.borderColor='var(--border)'}
                      />
                      <span style={{ fontSize:13,color:'var(--text-2)' }}>{ing.unit}</span>
                      {/* プレビュー */}
                      {have > 0 && (
                        <span style={{
                          marginLeft:'auto',fontSize:13,fontWeight:600,
                          color: needed === 0 ? '#3B6D11' : 'var(--blue)',
                        }}>
                          {needed === 0 ? '✓ 足りてます' : `→ ${fmtNum(needed)} ${ing.unit}購入`}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* テキスト材料 */}
          {textItems.length > 0 && (
            <>
              <div style={{ fontSize:12,fontWeight:600,color:'var(--text-3)',marginTop:16,marginBottom:8 }}>
                目分量で判断する材料
              </div>
              {textItems.map((ing, i) => (
                <div key={i} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 12px',
                  background:'var(--bg)',border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)',marginBottom:6,
                  fontSize:14,
                }}>
                  <span>{ing.name}</span>
                  <span style={{ color:'var(--text-3)',fontSize:13 }}>
                    {ing.amount_text || '適量'}（目安）
                  </span>
                </div>
              ))}
            </>
          )}

          <button
            onClick={() => setMode('list')}
            className="btn btn-primary"
            style={{ width:'100%',justifyContent:'center',padding:'13px 0',fontSize:15,marginTop:20 }}
          >
            🛒 買い物リストを作る
          </button>
        </div>
      )}

      {/* ── 買い物リストモード ── */}
      {mode === 'list' && (
        <div style={{ padding:'16px 16px' }}>

          {allDone && (
            <div style={{
              background:'#EAF3DE',border:'1px solid #C0DD97',
              borderRadius:'var(--radius-sm)',padding:'10px 14px',
              fontSize:13,color:'#3B6D11',marginBottom:14,
              display:'flex',alignItems:'center',gap:8,
            }}>
              ✓ すべてチェックしました！買い物完了です。
            </div>
          )}

          {/* 購入が必要な材料 */}
          {listItems.filter(i => i.needed > 0).length > 0 && (
            <>
              <div style={{ fontSize:12,fontWeight:600,color:'var(--text-3)',marginBottom:8 }}>
                購入が必要な材料
              </div>
              {listItems.filter(i => i.needed > 0).map((item, i) => (
                <div
                  key={i}
                  onClick={() => setChecked(prev => {
                    const n = new Set(prev); n.has(item.name) ? n.delete(item.name) : n.add(item.name); return n
                  })}
                  style={{
                    display:'flex',alignItems:'center',gap:12,
                    padding:'12px 14px',
                    background: checked.has(item.name) ? 'var(--bg)' : 'var(--surface)',
                    border:'1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',marginBottom:6,
                    cursor:'pointer',opacity: checked.has(item.name) ? .55 : 1,
                    transition:'all var(--t)',
                  }}
                >
                  <div style={{
                    width:22,height:22,borderRadius:4,flexShrink:0,
                    border: checked.has(item.name) ? 'none' : '2px solid var(--border)',
                    background: checked.has(item.name) ? '#3B6D11' : 'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {checked.has(item.name) && <span style={{ color:'#fff',fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{
                    flex:1,fontSize:14,
                    textDecoration: checked.has(item.name) ? 'line-through' : 'none',
                  }}>{item.name}</span>
                  <span style={{
                    fontSize:14,fontWeight:600,
                    color: checked.has(item.name) ? 'var(--text-3)' : 'var(--blue)',
                  }}>
                    {fmtNum(item.needed)} {item.unit}
                    {item.have > 0 && (
                      <span style={{ fontSize:11,color:'var(--text-3)',marginLeft:4 }}>
                        （{fmtNum(item.required)}-{fmtNum(item.have)}）
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* 足りている材料 */}
          {listItems.filter(i => i.needed === 0 && i.have > 0).length > 0 && (
            <>
              <div style={{ fontSize:12,fontWeight:600,color:'#3B6D11',marginTop:14,marginBottom:8 }}>
                ✓ 手元にある材料（購入不要）
              </div>
              {listItems.filter(i => i.needed === 0 && i.have > 0).map((item, i) => (
                <div key={i} style={{
                  display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'10px 14px',background:'#EAF3DE',
                  border:'1px solid #C0DD97',borderRadius:'var(--radius-sm)',marginBottom:6,
                  fontSize:14,opacity:.7,
                }}>
                  <span style={{ textDecoration:'line-through',color:'var(--text-3)' }}>{item.name}</span>
                  <span style={{ fontSize:12,color:'#3B6D11' }}>足りてます</span>
                </div>
              ))}
            </>
          )}

          {/* テキスト材料 */}
          {textItems.length > 0 && (
            <>
              <div style={{ fontSize:12,fontWeight:600,color:'var(--text-3)',marginTop:14,marginBottom:8 }}>
                目分量で確認してください
              </div>
              {textItems.map((ing, i) => (
                <div
                  key={i}
                  onClick={() => setChecked(prev => {
                    const n = new Set(prev); n.has(ing.name) ? n.delete(ing.name) : n.add(ing.name); return n
                  })}
                  style={{
                    display:'flex',alignItems:'center',gap:12,
                    padding:'10px 14px',
                    background: checked.has(ing.name) ? 'var(--bg)' : 'var(--surface)',
                    border:'1px solid var(--border)',
                    borderRadius:'var(--radius-sm)',marginBottom:6,
                    cursor:'pointer',opacity: checked.has(ing.name) ? .55 : 1,
                  }}
                >
                  <div style={{
                    width:22,height:22,borderRadius:4,flexShrink:0,
                    border: checked.has(ing.name) ? 'none' : '2px solid var(--border)',
                    background: checked.has(ing.name) ? '#3B6D11' : 'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {checked.has(ing.name) && <span style={{ color:'#fff',fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{
                    flex:1,fontSize:14,
                    textDecoration: checked.has(ing.name) ? 'line-through' : 'none',
                    color: checked.has(ing.name) ? 'var(--text-3)' : 'var(--text-1)',
                  }}>{ing.name}</span>
                  <span style={{ fontSize:13,color:'var(--text-3)' }}>
                    {ing.amount_text || '適量'}
                  </span>
                </div>
              ))}
            </>
          )}

          <button
            onClick={() => navigate(-1)}
            className="btn btn-ghost"
            style={{ width:'100%',justifyContent:'center',padding:'11px 0',marginTop:20 }}
          >
            レシピに戻る
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
