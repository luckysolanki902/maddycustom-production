import React from "react";
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Slide,
} from "@mui/material";
import Image from "next/image";
import searchStyles from "../utils/styles/categorysearchbox.module.css";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="down" ref={ref} {...props} />;
});

const SearchDialog = ({
  open,
  onClose,
  searchText,
  handleInputChange,
  handleSuggestionClick,
  suggestions,
  baseUrl,
  dialogSearchBoxRef,
}) => {
  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      TransitionComponent={Transition}
      PaperProps={{
        style: { backgroundColor: "white" },
      }}
    >
      <AppBar
        sx={{
          position: "relative",
          backgroundColor: "white",
          boxShadow: "none",
        }}
      >
        <Toolbar className={searchStyles.searchheader}>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <Image
              src={`${baseUrl}/assets/icons/left-arrow.png`}
              width={24}
              height={24}
              alt="Close"
              style={{ cursor: "pointer" }}
            />
          </IconButton>
          <Typography
            sx={{ ml: 2, flex: 1, color: "black", fontFamily: "Jost" }}
            variant="h6"
            component="div"
          >
            Customize your vehicle, your way!
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Search Box */}
      <Box
        sx={{ p: 2, position: "relative", height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Box
          className={searchStyles.searchBoxSubContainer}
          sx={{ display: "flex", alignItems: "center", mb: 2 }}
        >
          <Image
            src={`${baseUrl}/assets/icons/search.png`}
            width={24}
            height={24}
            alt="Search"
            style={{ marginRight: "16px" }}
          />
          <input
            ref={dialogSearchBoxRef}
            type="text"
            spellCheck={false}
            onChange={handleInputChange}
            value={searchText}
            className={`${searchStyles.inputField} ${searchStyles.dialogInputField}`}
            autoFocus
            style={{ flex: 1, fontSize: "1.2rem", border: "none", outline: "none", background: "transparent" }}
            placeholder="Search..."
          />
        </Box>

        {/* Suggestion List */}
        <Box sx={{ flex: 1, overflowY: "auto" }} className={searchStyles.suggestionBox}>
          {suggestions.length > 0 ? (
            <List>
              {suggestions.map((suggestion, index) => (
                <ListItemButton
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className={searchStyles.suggestionItem}
                >
                  <ListItemIcon>
                    <Image
                      src={`${baseUrl}/assets/icons/search.png`}
                      width={18}
                      height={18}
                      alt="Search Icon"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center">
                        <Typography variant="body1" component="span" sx={{ fontFamily: "Jost" }}>
                          {suggestion}
                        </Typography>
                        {["helmet", "tank", "pillar", "bonnet"].some((word) =>
                          suggestion?.toLowerCase().includes(word)
                        ) && (
                          <Image
                            src={`${baseUrl}/assets/icons/new.png`}
                            loading="eager"
                            width={30}
                            height={30}
                            alt="New"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          ) : (
            <Typography variant="h6" align="center" sx={{ mt: 4, fontFamily: "Jost" }}>
              No results found
            </Typography>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default SearchDialog;