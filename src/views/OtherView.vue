<template>
  <div class="about">
    <h1>This is an {{ pageName }} page</h1>
  </div>
</template>
<script>
import { ref } from "vue";
export default {
  setup() {
    const pageName = ref("other");
    return {
      pageName,
    };
  },
};
</script>
