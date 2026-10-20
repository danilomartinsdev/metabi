<script setup lang="ts">
definePageMeta({ titulo: 'Ranking de estados', permissao: 'dashboard.view' });
useHead({ title: 'Ranking de estados — MetaBI' });
</script>

<template>
  <DashboardRankingPagina dim="estados" />
</template>
