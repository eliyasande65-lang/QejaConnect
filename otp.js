// ── OTP verification ─────────────────────────────────────
let otpEmail     = '';
let resendTimer  = null;
let resendSeconds = 0;

function openOtpModal(email) {
    otpEmail = email;
    document.getElementById('otpEmailDisplay').textContent = email;
    document.getElementById('otpInput').value = '';
    document.getElementById('otpModal').classList.add('show');
    startResendCooldown(30);
}

function closeOtpModal() {
    document.getElementById('otpModal').classList.remove('show');
    clearInterval(resendTimer);
}

document.getElementById('closeOtpModal').addEventListener('click', closeOtpModal);
document.getElementById('otpModal').addEventListener('click', (e) => {
    if (e.target.id === 'otpModal') closeOtpModal();
});

function startResendCooldown(seconds) {
    resendSeconds = seconds;
    const resendBtn  = document.getElementById('resendOtpBtn');
    const cooldownEl = document.getElementById('resendCooldown');
    resendBtn.disabled = true;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        resendSeconds--;
        if (resendSeconds <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            cooldownEl.textContent = '';
        } else {
            cooldownEl.textContent = `(${resendSeconds}s)`;
        }
    }, 1000);
}

document.getElementById('resendOtpBtn').addEventListener('click', async function () {
    if (this.disabled) return;
    try {
        const res  = await fetch(`${API}/auth/send-otp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: otpEmail, purpose: 'signup' })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('New code sent.', 'success');
            startResendCooldown(30);
        } else {
            showToast(data.message || 'Could not resend code.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    }
});

document.getElementById('verifyOtpBtn').addEventListener('click', async function () {
    const otp = document.getElementById('otpInput').value.trim();
    if (!/^\d{6}$/.test(otp)) {
        showToast('Enter the 6-digit code.', 'warning');
        return;
    }

    this.disabled = true;
    this.textContent = 'Verifying…';

    try {
        const res  = await fetch(`${API}/auth/verify-email`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email: otpEmail, otp })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showToast('Email verified! Redirecting to login…', 'success', 2500);
            closeOtpModal();
            setTimeout(() => { window.location.replace('login.html'); }, 2000);
        } else {
            showToast(data.message || 'Incorrect or expired code.', 'error');
        }
    } catch (err) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        this.disabled = false;
        this.textContent = 'Verify';
    }
});
