const { createApp } = Vue

createApp({
  data() {
    return {
      committeeMembers: []
    }
  },
  methods: {
    async fetchCommitteeData() {
      try {
        const response = await fetch('/api/committee');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        this.committeeMembers = await response.json();
      } catch (error) {
        console.error("Could not fetch committee data:", error);
        this.committeeMembers = [];
      }
    }
  },
  mounted() {
    this.fetchCommitteeData();
  }
}).mount('#committee-app')
