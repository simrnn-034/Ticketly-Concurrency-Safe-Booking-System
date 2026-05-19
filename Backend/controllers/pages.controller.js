export const renderEventPage = async (req, res) => {
  const { id } = req.params;
  return res.redirect(`/event.html?id=${encodeURIComponent(id)}`);
};