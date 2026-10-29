"""HTTP integration checks against a local preview; synthetic data only."""
import copy,http.cookiejar,json,os,pathlib,unittest,urllib.request,urllib.error,uuid
BASE=os.environ.get('BMTI_TEST_URL','http://127.0.0.1:5187')
SECRET=pathlib.Path(os.environ.get('BMTI_ADMIN_PASSWORD_FILE',str(pathlib.Path.home()/'.config/heretoo-bmti/admin-access.txt')))
class Browser:
 def __init__(self):self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def request(self,path,body=None,method=None,origin=BASE,**headers):
  req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json','Origin':origin,**headers})
  try:
   with self.http.open(req) as r:return r.status,json.load(r),r.headers
  except urllib.error.HTTPError as r:
   text=r.read().decode()
   try:payload=json.loads(text)
   except json.JSONDecodeError:payload={'error':text}
   return r.code,payload,r.headers
class API(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.admin=Browser();password=SECRET.read_text().split('管理口令：')[1].splitlines()[0]
  cls.login=cls.admin.request('/api/admin',{'action':'login','password':password})
  assert cls.login[0]==200,cls.login[:2]
  cls.bank=json.loads(pathlib.Path('lib/questions.json').read_text());cls.keys={q['id']:q['endpoint'] for q in cls.bank}
 @classmethod
 def tearDownClass(cls):cls.admin.request('/api/admin',{'action':'settings','questionCount':32});cls.admin.request('/api/admin',{'action':'logout'})
 def setUp(self):self.user=Browser()
 def start(self,count=32):
  self.assertEqual(self.admin.request('/api/admin',{'action':'settings','questionCount':count})[0],200)
  status,a,_=self.user.request('/api/test',{'action':'start','nickname':'合成验证旅人'});self.assertEqual(status,200);return a
 def values(self,a):return [{'id':q['id'],'value':4 if self.keys[q['id']] in 'VTFI' else 2} for q in a['questions']]
 def test_admin_auth_origin_and_bounds(self):
  self.assertEqual(self.user.request('/api/admin')[0],401)
  self.assertEqual(self.user.request('/api/admin',{'action':'settings','questionCount':8})[0],401)
  self.assertEqual(self.admin.request('/api/admin',{'action':'settings','questionCount':8},origin='https://evil.test')[0],403)
  for n in [7,33,12.5,True,'24']:self.assertEqual(self.admin.request('/api/admin',{'action':'settings','questionCount':n})[0],422)
  self.assertIn('HttpOnly',self.login[2]['Set-Cookie'])
 def test_complete_role_report_reload_idempotency_and_delete(self):
  a=self.start();self.assertEqual(len(a['questions']),32);self.assertNotIn('endpoint',a['questions'][0])
  status,r,_=self.user.request('/api/test',{'action':'submit','id':a['id'],'answers':self.values(a)});self.assertEqual(status,200);self.assertEqual(r['report']['role'],'旷野哲思者')
  self.assertEqual(self.user.request('/api/test?id='+a['id'])[1]['report'],r['report'])
  self.assertEqual(self.user.request('/api/test',{'action':'submit','id':a['id'],'answers':[]})[1]['report'],r['report'])
  self.assertEqual(self.user.request('/api/test?id='+a['id'],method='DELETE')[0],200)
  self.assertEqual(self.user.request('/api/test?id='+a['id'])[0],404)
 def test_cross_browser_report_isolation(self):
  a=self.start();other=Browser()
  self.assertEqual(other.request('/api/test?id='+a['id'])[0],404)
  self.assertEqual(other.request('/api/test',{'action':'submit','id':a['id'],'answers':self.values(a)})[0],404)
  other.request('/api/test?id='+a['id'],method='DELETE')
  self.assertEqual(self.user.request('/api/test?id='+a['id'])[0],200)
 def test_config_draw_and_inflight_snapshot(self):
  a=self.start(8);self.assertEqual(len(a['questions']),8)
  self.admin.request('/api/admin',{'action':'settings','questionCount':24})
  self.assertEqual(len(self.user.request('/api/test?id='+a['id'])[1]['questions']),8)
  status,r,_=self.user.request('/api/test',{'action':'submit','id':a['id'],'answers':self.values(a)});self.assertEqual(status,200);self.assertIsNone(r['report']['role']);self.assertTrue(all(s['mean'] is None for s in r['report']['scores'].values()))
  b=self.user.request('/api/test',{'action':'start','nickname':'重做旅人'})[1];self.assertEqual(len(b['questions']),24);self.assertNotEqual(a['id'],b['id'])
 def test_strict_answers_and_missing_values(self):
  a=self.start();values=self.values(a)
  for invalid in [values[:-1],[values[0]]*32,[{'id':v['id'],'value':True} for v in values]]:
   self.assertEqual(self.user.request('/api/test',{'action':'submit','id':a['id'],'answers':invalid})[0],422)
  values=[{'id':q['id'],'value':'unable'} for q in a['questions']]
  status,r,_=self.user.request('/api/test',{'action':'submit','id':a['id'],'answers':values});self.assertEqual(status,200);self.assertEqual(r['report']['valid'],0);self.assertEqual(r['report']['code'],'????')
 def test_nickname_and_public_config(self):
  for name in ['', ' '*3,'a'*25,'bad\nname']:self.assertEqual(self.user.request('/api/test',{'action':'start','nickname':name})[0],422)
  cfg=self.user.request('/api/test')[1];self.assertEqual(set(cfg),{'questionCount','version','bankCount'})
 def test_admin_logout_revokes_cookie(self):
  b=Browser();password=SECRET.read_text().split('管理口令：')[1].splitlines()[0]
  self.assertEqual(b.request('/api/admin',{'action':'login','password':password})[0],200)
  self.assertEqual(b.request('/api/admin',{'action':'logout'})[0],200);self.assertEqual(b.request('/api/admin')[0],401)
 def test_legacy_visitor_retains_report_ownership(self):
  a=self.start()
  original=next(c for c in self.user.jar if c.name=='bmti_visitor')
  old=copy.copy(original);old.name='hgp_visitor'
  self.user.jar.clear();self.user.jar.set_cookie(old)
  self.assertEqual(self.user.request('/api/test?id='+a['id'])[0],200)
  new=self.user.request('/api/test',{'action':'start','nickname':'合成兼容验证'})
  self.assertEqual(new[0],200)
  migrated=next(c for c in self.user.jar if c.name=='bmti_visitor')
  self.assertEqual(migrated.value,original.value)
  self.assertEqual(self.user.request('/api/test?id='+a['id'])[0],200)
 def test_logout_revokes_new_and_legacy_admin_sessions(self):
  password=SECRET.read_text().split('管理口令：')[1].splitlines()[0]
  old=Browser();new=Browser()
  for b in [old,new]:self.assertEqual(b.request('/api/admin',{'action':'login','password':password})[0],200)
  old_cookie=copy.copy(next(c for c in old.jar if c.name=='bmti_admin'));old_cookie.name='hgp_admin'
  old.jar.clear();old.jar.set_cookie(old_cookie)
  self.assertEqual(old.request('/api/admin')[0],200)
  current=copy.copy(next(c for c in new.jar if c.name=='bmti_admin'))
  old.jar.set_cookie(current)
  response=old.request('/api/admin',{'action':'logout'})
  self.assertEqual(response[0],200)
  self.assertEqual(len(response[2].get_all('Set-Cookie')),2)
  self.assertEqual(old.request('/api/admin')[0],401)
  old.jar.set_cookie(old_cookie)
  self.assertEqual(old.request('/api/admin')[0],401)
  self.assertEqual(new.request('/api/admin')[0],401)
 def test_login_rate_limit(self):
  b=Browser();headers={'CF-Connecting-IP':'synthetic-'+str(uuid.uuid4())}
  for i in range(8):self.assertEqual(b.request('/api/admin',{'action':'login','password':'deliberately-wrong'},**headers)[0],401)
  self.assertEqual(b.request('/api/admin',{'action':'login','password':'deliberately-wrong'},**headers)[0],429)
if __name__=='__main__':unittest.main(verbosity=2)
