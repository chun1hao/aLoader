import { useRoute } from "vue-router";
export default function () {
  const route = useRoute();

  console.log(`我是header文件 我在 ${route.name} 文件执行了`);
}
