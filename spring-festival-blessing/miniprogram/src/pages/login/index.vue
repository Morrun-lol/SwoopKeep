<template>
  <view class="container">
    <view class="header">
      <text class="title">Login</text>
    </view>
    <view class="content">
      <button type="primary" class="login-btn" @click="handleWechatLogin">WeChat One-Click Login</button>
      <button class="cancel-btn" @click="handleCancel">Cancel</button>
    </view>
  </view>
</template>

<script setup lang="ts">


const handleWechatLogin = () => {
  uni.showLoading({ title: '登录中...' })
  
  // 1. Get User Profile
  uni.getUserProfile({
    desc: '获取您的头像和昵称用于生成祝福卡片',
    success: (res: any) => {
      const userInfo = res.userInfo
      
      // 2. Login
      uni.login({
        provider: 'weixin',
        success: (loginRes: any) => {
          // 3. Call Backend
          uni.request({
            url: 'http://localhost:3001/api/auth/wechat-login',
            method: 'POST',
            data: {
              code: loginRes.code,
              userInfo: userInfo
            },
            success: (apiRes: any) => {
               uni.hideLoading()
               const { token, userId } = apiRes.data
               if (token) {
                 uni.setStorageSync('token', token)
                 uni.setStorageSync('userId', userId)
                 uni.setStorageSync('userInfo', JSON.stringify(userInfo))
                 uni.showToast({ title: '登录成功' })
                 setTimeout(() => {
                   uni.navigateBack()
                 }, 1500)
               } else {
                 uni.showToast({ title: '服务器错误' })
               }
            },
            fail: (err: any) => {
              uni.hideLoading()
              console.error(err)
              uni.showToast({ title: '网络错误' })
            }
          })
        },
        fail: () => {
          uni.hideLoading()
          uni.showToast({ title: '登录失败' })
        }
      })
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '授权被拒绝' })
    }
  })
}

const handleCancel = () => {
  uni.navigateBack()
}
</script>

<style scoped>
.container {
  padding: 40px 20px;
  background-color: #f8f8f8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.header {
  text-align: center;
  margin-bottom: 60px;
}
.title {
  font-size: 24px;
  font-weight: bold;
}
.login-btn {
  margin-bottom: 20px;
  width: 100%;
}
.cancel-btn {
  width: 100%;
}
</style>
