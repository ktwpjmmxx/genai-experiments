import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchRecipes } from '../api/recipeApi'
import BottomNav from '../components/BottomNav'
import '../global.css'

// ── 時刻・季節スコアリング ──────────────────────
function scoreRecipe(recipe) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  let score = 0

  // 時刻スコア
  if (h < 11 && recipe.cook_time <= 20)  score += 3  // 朝：時短優先
  if (h >= 11 && h < 17)                score += (recipe.category === '副菜' ? 2 : 0) // 昼：副菜
  if (h >= 17 && recipe.cook_time > 20)  score += 3  // 夜：ガッツリ
  if (h >= 17 && recipe.category === '和食') score += 1

  // 季節スコア
  if ([6,7,8].includes(m) && ['アジアン','洋食'].includes(recipe.category)) score += 2 // 夏
  if ([11,12,1,2].includes(m) && ['和食','中華'].includes(recipe.category)) score += 2 // 冬

  // お気に入りボーナス
  if (recipe.is_favorite) score += 1

  return score
}

function timeLabel() {
  const h = new Date().getHours()
  if (h < 11) return 'おはようございます'
  if (h < 17) return 'こんにちは'
  return 'こんばんは'
}

function aiSuggestReason(recipe) {
  const h = new Date().getHours()
  const m = new Date().getMonth() + 1
  if (h < 11) return '朝は時短レシピがおすすめです'
  if (h >= 17 && recipe.cook_time > 20) return '夜ごはんにじっくり作りたい一品です'
  if ([6,7,8].includes(m)) return '夏にぴったりさっぱりした料理です'
  if ([11,12,1,2].includes(m)) return '寒い季節に体が温まる一品です'
  return 'あなたのライブラリから選びました'
}

// トレンドモック（オンライン化後に実APIに差し替え）
const MOCK_TRENDS = [
  { title: '親子丼',       heat: '1.2k', img: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&q=60' },
  { title: '醤油ラーメン', heat: '980',  img: 'https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=200&q=60' },
  { title: 'チャーハン',   heat: '741',  img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&q=60' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [recipes,   setRecipes]   = useState([])
  const [aiSuggest, setAiSuggest] = useState(null)

  useEffect(() => {
    fetchRecipes({ sort: 'updated_at', order: 'desc' })
      .then(list => {
        setRecipes(list)
        if (list.length > 0) {
          const scored = [...list].sort((a, b) => scoreRecipe(b) - scoreRecipe(a))
          setAiSuggest(scored[0])
        }
      })
      .catch(() => {})
  }, [])

  const recent = recipes.slice(0, 3)

  return (
    <div className="page-wrapper">

      {/* ── ヘッダー ── */}
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <div className="topbar-title">🍳 MyRecipe</div>
            <div className="topbar-sub">{timeLabel()}</div>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(255,255,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 600, color: '#fff',
          }}>田</div>
        </div>
      </div>

      {/* ── AI発見バナー（常に最上部） ── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div
          onClick={() => navigate('/discover')}
          style={{
            background: 'linear-gradient(135deg, #6D28D9 0%, #185FA5 100%)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
            transition: 'opacity var(--t)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ fontSize: 28 }}>✦</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>
              AIに今日の料理を相談する
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
              気分や時間を伝えるとレシピを提案・生成します
            </div>
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,.7)' }}>›</div>
        </div>
      </div>

      {/* ── AIおすすめ（ライブラリから） ── */}
      {aiSuggest && (
        <>
          <div className="section-label">
            ✦ 今夜のAIおすすめ
          </div>
          <div style={{ padding: '0 16px' }}>
            <div
              onClick={() => navigate(`/recipes/${aiSuggest.id}`)}
              style={{
                background: 'var(--gold-light)', border: '1px solid #E8D080',
                borderRadius: 'var(--radius-md)', display: 'flex',
                gap: 12, padding: 14, cursor: 'pointer',
                transition: 'box-shadow var(--t)',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
            >
              <div style={{
                width: 70, height: 70, borderRadius: 'var(--radius-sm)',
                overflow: 'hidden', flexShrink: 0,
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {aiSuggest.image_url
                  ? <img src={aiSuggest.image_url} alt={aiSuggest.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 30, opacity: .4 }}>🍳</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--gold-dark)', fontWeight: 600, marginBottom: 4 }}>
                  あなたの好みから推測
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{aiSuggest.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  ⏱ {aiSuggest.cook_time}分　👥 {aiSuggest.base_servings}人前
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>
                  {aiSuggestReason(aiSuggest)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ライブラリが空のとき ── */}
      {recipes.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-light)',
            margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 30 }}>🍳</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>レシピを追加してみましょう</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 16 }}>
            上のAI相談からレシピを発見するか<br />右下の＋ボタンで手動追加できます
          </p>
        </div>
      )}

      {/* ── 今週のトレンド（オンライン化後有効） ── */}
      <div className="section-label" style={{ marginTop: 10 }}>
        📈 今週のトレンド
        <span style={{
          fontSize: 10, background: '#FCEBEB', color: '#A32D2D',
          padding: '2px 6px', borderRadius: 4, marginLeft: 6,
        }}>オンライン化後に有効</span>
      </div>
      <div style={{
        display: 'flex', gap: 10, padding: '0 16px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {MOCK_TRENDS.map((t, i) => (
          <div key={i} style={{
            flexShrink: 0, width: 110,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', overflow: 'hidden', opacity: .55,
          }}>
            <img src={t.img} alt={t.title}
              style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '6px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 10, color: '#E24B4A', marginTop: 2 }}>
                🔥 {t.heat}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 最近追加したレシピ ── */}
      {recent.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 10 }}>
            🕐 最近追加したレシピ
          </div>
          <div style={{
            display: 'flex', gap: 10, padding: '0 16px',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {recent.map(r => (
              <div
                key={r.id}
                onClick={() => navigate(`/recipes/${r.id}`)}
                style={{
                  flexShrink: 0, width: 130,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer',
                  transition: 'box-shadow var(--t)',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
              >
                <div style={{
                  height: 80, background: 'var(--gold-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {r.image_url
                    ? <img src={r.image_url} alt={r.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 32, opacity: .4 }}>🍳</span>
                  }
                </div>
                <div style={{ padding: '7px 9px' }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.title}</div>
                  <span className={`cat-badge cat-${r.category}`} style={{ marginTop: 4, fontSize: 10 }}>
                    {r.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
      <BottomNav />
    </div>
  )
}
