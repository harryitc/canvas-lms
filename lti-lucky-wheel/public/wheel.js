// Vong quay phia client. Server quyet dinh ket qua (index); o day chi ve + quay
// sao cho kim dung lai dung o phan qua do.
(() => {
  const boot = window.__BOOT__ || {}
  const prizes = boot.prizes || []
  const canvas = document.getElementById('wheel')
  const ctx = canvas.getContext('2d')
  const btn = document.getElementById('spinBtn')
  const resultEl = document.getElementById('result')
  const gradeEl = document.getElementById('grade')

  function showGrade(grade) {
    if (!grade) return
    if (grade.ok) {
      gradeEl.textContent = `Da ghi ${grade.score} diem vao so diem Canvas.`
      gradeEl.className = 'grade ok'
    } else {
      gradeEl.textContent = `Khong ghi duoc diem: ${grade.error || 'loi'}`
      gradeEl.className = 'grade err'
    }
  }

  const N = prizes.length
  const SEG = (2 * Math.PI) / N
  const POINTER = -Math.PI / 2 // kim o dinh (huong len tren)
  const R = canvas.width / 2

  let rot = 0 // goc xoay hien tai (radian)
  let spinning = false

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(R, R)
    ctx.rotate(rot)

    for (let i = 0; i < N; i++) {
      const start = i * SEG
      const end = start + SEG
      // mieng banh
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, R - 6, start, end)
      ctx.closePath()
      ctx.fillStyle = prizes[i].color
      ctx.fill()

      // nhan
      ctx.save()
      ctx.rotate(start + SEG / 2)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillText(prizes[i].label, R - 18, 5)
      ctx.restore()
    }
    ctx.restore()

    // truc giua
    ctx.beginPath()
    ctx.arc(R, R, 16, 0, 2 * Math.PI)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }

  // Goc xoay can thiet de tam cua segment `index` nam duoi kim.
  function targetRotation(index) {
    const center = index * SEG + SEG / 2
    // them jitter nho de khong luc nao cung dung chinh giua
    const jitter = (Math.random() - 0.5) * SEG * 0.6
    const base = POINTER - (center + jitter)
    const extraSpins = 5 // so vong quay cho dep mat
    // chuan hoa de luon quay xuoi chieu va du nhieu vong
    let target = base
    while (target < rot + extraSpins * 2 * Math.PI) target += 2 * Math.PI
    return target
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3)
  }

  function animateTo(target, onDone) {
    const startRot = rot
    const delta = target - startRot
    const duration = 4200
    let startTime = null

    function frame(now) {
      if (startTime === null) startTime = now
      const t = Math.min((now - startTime) / duration, 1)
      rot = startRot + delta * easeOut(t)
      draw()
      if (t < 1) requestAnimationFrame(frame)
      else onDone && onDone()
    }
    requestAnimationFrame(frame)
  }

  function showWin(label) {
    resultEl.textContent = 'Ban trung: ' + label + ' !'
    resultEl.classList.add('win')
  }

  function lockAfterSpin(label) {
    btn.disabled = true
    btn.textContent = 'DA QUAY XONG'
    showWin(label)
  }

  async function spin() {
    if (spinning) return
    spinning = true
    btn.disabled = true
    resultEl.textContent = ''
    resultEl.classList.remove('win')

    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launchToken: boot.launchToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Loi khi quay')

      animateTo(targetRotation(data.index), () => {
        spinning = false
        lockAfterSpin(data.prize)
        showGrade(data.grade)
      })
    } catch (err) {
      spinning = false
      btn.disabled = false
      resultEl.textContent = 'Loi: ' + err.message
    }
  }

  // Khoi tao
  draw()

  if (boot.alreadySpun && boot.prizeIndex >= 0) {
    // Da quay tu truoc -> quay san toi ket qua cu va khoa nut.
    rot = targetRotation(boot.prizeIndex)
    draw()
    lockAfterSpin(boot.prizeLabel)
    showGrade(boot.grade)
  } else {
    btn.addEventListener('click', spin)
  }
})()
