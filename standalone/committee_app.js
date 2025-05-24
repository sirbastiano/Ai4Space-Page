const { createApp } = Vue;

createApp({
  data() {
    return {
      committeeMembers: [],
      loading: true,
    };
  },
  mounted() {
    // Use the static data embedded in committee.html
    if (typeof staticCommitteeData !== 'undefined') {
      this.committeeMembers = staticCommitteeData;
      this.loading = false;
    } else {
      console.error("staticCommitteeData is not defined. Make sure it's correctly embedded in committee.html");
      this.loading = false; // Stop loading even if data is not found
    }
  },
}).mount('#committee-app');
