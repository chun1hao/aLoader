## 自动引入文件并执行
1. autoimport.config 里面配置文件的名称，配置后在打包过程在该文件添加上
```js
import useHeader from '@/hooks/header'

// 文件setup中会插入
useHeader()
```
2. 文件需要有script 并包含 setup(){}
3. 需要添加在vue-loader执行之前
