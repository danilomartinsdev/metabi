export default defineEventHandler(event => {
  deleteCookie(event, 'meta_bi_token')
  return { ok: true }
})
