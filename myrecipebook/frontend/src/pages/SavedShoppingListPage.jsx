import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchShoppingList, updateShoppingListItems, deleteShoppingList } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

function fmtNum(val) {
  if (val === null || val === undefined) return ''
  if (val === 0) return '0'
  if (Number.isInteger(val)) return String(val)
  const f = val.toFixed(1)
  return f.endsWith('.0') ? f.slice(0, -2) : f
}

export default function SavedShoppingListPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [list,       setList]       = useState(null)
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [showDelConf,setShowDelConf]= useState(false)
  const [showToast,  setShowToast]  = useState(false)

  useEffect(() => {
    fetchShoppingList(id)
      .then(data => {
        setList(data)
        setItems(data.items || [])
      })
      .catch(() => navigate('/library'))
      .finally(() => setLoading(false))
  }, [id])

  const toggleCheck = async (index) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    )
    setItems(updated)
    // チェック状態をバックエンドに保存
    setSaving(true)
    try {
      await updateShoppingListItems(id, updated)
    } catch {
      // 失敗してもUIは更新済みのまま（次回保存時に反映）
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    await deleteShoppingList(id)
    navigate('/library')
  }

  const fmtDate = (str) => {
    const d = new Date(str)
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  if (loading) return <div className="spinner">読み込み中…</div>
  if (!list)   return null

  const needItems  = items.filter(i => !i.is_text && (i.needed ?? 0) > 0)
  const haveItems  = items.filter(i => !i.is_text && (i.needed ?? 1) === 0)
  const textItems  = items.filter(i => i.is_text)
  const doneCount  = items.filter(i => i.checked).length
  const totalCount = items.length
  const allDone    = doneCount === totalCount && totalCount > 0

  return (
    <div className="page-wrapper">

      {/* トースト */}
      {showToast && (
        <div style={{
          position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
          background:'#3B6D11',color:'#fff',
          padding:'10px 20px',borderRadius:999,
          fontSize:13,fontWeight:600,zIndex:999,
          boxShadow:'0 4px 16px rgba(0,0,0,.2)',
        }}>
          ✓ チェック状態を保存しました
        </div>
      )}

      {/* ヘッダー */}
      <div className="topbar">
        <div className="topbar-row">
          <button onClick={() => navigate('/library')} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 12px',
            color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
          }}>← 戻る</button>
          <span className="topbar-title" style={{ flex:1,textAlign:'center' }}>
            買い物リスト
          </span>
          <button onClick={() => setShowDelConf(true)} style={{
            background:'rgba(255,255,255,.2)',border:'1px solid rgba(255,255,255,.4)',
            borderRadius:'var(--radius-sm)',padding:'6px 10px',
            color:'#fff',fontSize:12,fontWeight:600,cursor:'pointer',
          }}>🗑 削除</button>
        </div>
      </div>

      {/* レシピ名・人数・作成日 */}
      <div style={{
        padding:'12px 16px',background:'var(--gold-light)',
        borderBottom:'1px solid #E8D080',
      }}>
        <div style={{ fontSize:15,fontWeight:600,color:'var(--gold-dark)',marginBottom:3 }}>
          {list.recipe_title}
        </div>
        <div style={{ fontSize:12,color:'var(--text-3)',display:'flex',gap:12 }}>
          <span>👥 {list.servings}人前</span>
          <span>🕐 作成: {fmtDate(list.created_at)}</span>
        </div>
      </div>

      {/* 進捗バー */}
      <div style={{
        padding:'10px 16px',background:'var(--surface)',
        borderBottom:'1px solid var(--border)',
      }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ flex:1,height:6,background:'#E5E7EB',borderRadius:999,overflow:'hidden' }}>
            <div style={{
              height:'100%',
              background: allDone ? '#3B6D11' : 'var(--blue)',
              borderRadius:999,
              width:`${totalCount>0?(doneCount/totalCount)*100:0}%`,
              transition:'width .3s ease',
            }} />
          </div>
          <span style={{ fontSize:12,color: allDone ? '#3B6D11' : 'var(--text-3)',fontWeight:allDone?600:400,flexShrink:0 }}>
            {allDone ? '✓ 買い物完了！' : `${doneCount} / ${totalCount} 完了`}
          </span>
        </div>
      </div>

      <div style={{ padding:'14px 16px' }}>

        {/* 購入が必要な材料 */}
        {needItems.length > 0 && (
          <>
            <div style={{ fontSize:12,fontWeight:600,color:'var(--text-3)',marginBottom:8 }}>
              購入が必要な材料
            </div>
            {needItems.map((item, i) => {
              const idx = items.indexOf(item)
              return (
                <div key={i} onClick={() => toggleCheck(idx)} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'12px 14px',
                  background: item.checked ? 'var(--bg)' : 'var(--surface)',
                  border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)',marginBottom:6,
                  cursor:'pointer',opacity:item.checked?.55:1,
                  transition:'all var(--t)',
                }}>
                  <div style={{
                    width:22,height:22,borderRadius:4,flexShrink:0,
                    border:item.checked?'none':'2px solid var(--border)',
                    background:item.checked?'#3B6D11':'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {item.checked && <span style={{ color:'#fff',fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{
                    flex:1,fontSize:14,
                    textDecoration:item.checked?'line-through':'none',
                    color:item.checked?'var(--text-3)':'var(--text-1)',
                  }}>{item.name}</span>
                  <span style={{
                    fontSize:14,fontWeight:600,
                    color:item.checked?'var(--text-3)':'var(--blue)',
                  }}>
                    {fmtNum(item.needed)} {item.unit}
                  </span>
                </div>
              )
            })}
          </>
        )}

        {/* 足りている材料 */}
        {haveItems.length > 0 && (
          <>
            <div style={{ fontSize:12,fontWeight:600,color:'#3B6D11',marginTop:14,marginBottom:8 }}>
              ✓ 手元にある材料（購入不要）
            </div>
            {haveItems.map((item, i) => (
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
            {textItems.map((item, i) => {
              const idx = items.indexOf(item)
              return (
                <div key={i} onClick={() => toggleCheck(idx)} style={{
                  display:'flex',alignItems:'center',gap:12,
                  padding:'10px 14px',
                  background:item.checked?'var(--bg)':'var(--surface)',
                  border:'1px solid var(--border)',
                  borderRadius:'var(--radius-sm)',marginBottom:6,
                  cursor:'pointer',opacity:item.checked?.55:1,
                }}>
                  <div style={{
                    width:22,height:22,borderRadius:4,flexShrink:0,
                    border:item.checked?'none':'2px solid var(--border)',
                    background:item.checked?'#3B6D11':'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    {item.checked && <span style={{ color:'#fff',fontSize:14 }}>✓</span>}
                  </div>
                  <span style={{
                    flex:1,fontSize:14,
                    textDecoration:item.checked?'line-through':'none',
                    color:item.checked?'var(--text-3)':'var(--text-1)',
                  }}>{item.name}</span>
                  <span style={{ fontSize:13,color:'var(--text-3)' }}>
                    {item.text_val || '適量'}
                  </span>
                </div>
              )
            })}
          </>
        )}

        {saving && (
          <div style={{ fontSize:12,color:'var(--text-3)',textAlign:'center',marginTop:8 }}>
            保存中…
          </div>
        )}
      </div>

      {/* 削除確認 */}
      {showDelConf && (
        <div style={{
          position:'fixed',inset:0,background:'rgba(0,0,0,.45)',
          display:'flex',alignItems:'center',justifyContent:'center',
          zIndex:300,padding:20,
        }}>
          <div style={{
            background:'var(--surface)',borderRadius:'var(--radius-lg)',
            padding:24,maxWidth:300,width:'100%',
          }}>
            <p style={{ fontWeight:600,marginBottom:8 }}>この買い物リストを削除しますか？</p>
            <p style={{ fontSize:13,color:'var(--text-3)',marginBottom:20 }}>
              この操作は取り消せません。
            </p>
            <div style={{ display:'flex',gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowDelConf(false)}>
                キャンセル
              </button>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={handleDelete}>
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
