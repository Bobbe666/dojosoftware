import React from "react";
import MitgliedDetailShared from './MitgliedDetailShared';

/**
 * MitgliedDetail - Admin view for member details
 * This is a simple wrapper around MitgliedDetailShared with isAdmin=true
 *
 * Route: /dashboard/mitglieder/:id
 * Access: Admin only (protected by Dashboard routing)
 */
const MitgliedDetail = () => {
  return <MitgliedDetailShared isAdmin={true} />;
};

export default MitgliedDetail;
